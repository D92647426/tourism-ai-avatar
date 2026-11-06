package com.guide.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;

/** TEST-053: actual loopback HTTP, bounded audio and input/config rejection. */
class LocalSpeechServiceTest {
    final ObjectMapper mapper=new ObjectMapper();
    @Test void validatesBeforeCallingWorker() throws Exception {
        LocalSpeechService service=new LocalSpeechService(false,"http://127.0.0.1:9880",mapper);
        for(String body:Arrays.asList("{}","{\"text\":\" \"}","{\"text\":\"x\",\"speed\":0}","{\"text\":\"x\",\"speed\":true}","{\"text\":\"x\",\"url\":\"secret\"}")) {
            assertEquals(400,assertThrows(LocalSpeechService.Failure.class,()->service.synthesize(mapper.readTree(body))).status);
        }
        assertEquals(503,assertThrows(LocalSpeechService.Failure.class,()->service.synthesize(mapper.readTree("{\"text\":\"你好\",\"speed\":1}"))).status);
        for(String url:Arrays.asList("https://example.com","http://example.com","http://127.0.0.1.evil/","http://user:pass@127.0.0.1:9880","http://127.0.0.1:9880/path"))
            assertThrows(IllegalArgumentException.class,()->new LocalSpeechService(true,url,mapper));
    }
    @Test void acceptsWavAndRejectsRedirectDamageAndOversize() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        int[] mode={0};byte[] wav=new byte[44];System.arraycopy("RIFF".getBytes("US-ASCII"),0,wav,0,4);System.arraycopy("WAVE".getBytes("US-ASCII"),0,wav,8,4);
        server.createContext("/synthesize",exchange->{
            exchange.getRequestBody().close();
            if(mode[0]==1){exchange.getResponseHeaders().set("Location","http://example.com");exchange.sendResponseHeaders(302,-1);}
            else {byte[] body=mode[0]==2?new byte[44]:mode[0]==3?new byte[4*1024*1024+1]:wav;exchange.sendResponseHeaders(200,body.length);try{exchange.getResponseBody().write(body);}catch(Exception ignored){}}
            exchange.close();
        });server.start();
        try {
            LocalSpeechService service=new LocalSpeechService(true,"http://127.0.0.1:"+server.getAddress().getPort(),mapper);
            assertArrayEquals(wav,service.synthesize(mapper.readTree("{\"text\":\"你好\",\"speed\":1}")));
            for(int value:new int[]{1,2,3}){mode[0]=value;assertEquals(502,assertThrows(LocalSpeechService.Failure.class,()->service.synthesize(mapper.readTree("{\"text\":\"你好\",\"speed\":1}"))).status);}
        }finally{server.stop(0);}
    }

    @Test void thirdConcurrentRequestIsRejectedWithoutWaiting() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        java.util.concurrent.ExecutorService handlers=java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.ExecutorService callers=java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.CountDownLatch entered=new java.util.concurrent.CountDownLatch(2),release=new java.util.concurrent.CountDownLatch(1);
        byte[] wav=new byte[44];System.arraycopy("RIFF".getBytes("US-ASCII"),0,wav,0,4);System.arraycopy("WAVE".getBytes("US-ASCII"),0,wav,8,4);
        server.setExecutor(handlers);server.createContext("/synthesize",exchange->{entered.countDown();try{release.await(5,java.util.concurrent.TimeUnit.SECONDS);exchange.sendResponseHeaders(200,wav.length);exchange.getResponseBody().write(wav);}catch(Exception ignored){}finally{exchange.close();}});server.start();
        try{
            LocalSpeechService service=new LocalSpeechService(true,"http://127.0.0.1:"+server.getAddress().getPort(),mapper);
            JsonTask task=()->service.synthesize(mapper.readTree("{\"text\":\"你好\"}"));
            java.util.concurrent.Future<byte[]> first=callers.submit(task::run),second=callers.submit(task::run);
            assertTrue(entered.await(3,java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(503,assertThrows(LocalSpeechService.Failure.class,task::run).status);
            release.countDown();assertArrayEquals(wav,first.get(3,java.util.concurrent.TimeUnit.SECONDS));assertArrayEquals(wav,second.get(3,java.util.concurrent.TimeUnit.SECONDS));
        }finally{release.countDown();server.stop(0);handlers.shutdownNow();callers.shutdownNow();}
    }
    interface JsonTask {byte[] run() throws Exception;}
}
