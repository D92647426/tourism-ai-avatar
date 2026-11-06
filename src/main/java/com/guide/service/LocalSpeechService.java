package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.Semaphore;

/** REQ-053: bounded loopback voice proxy; no chat/history changes or prompt logging.
 * See docs/local_voice_design.md and docs/config_reference.md. */
@Service
public class LocalSpeechService {
    private final boolean enabled;
    private final URI endpoint;
    private final ObjectMapper mapper;
    private final Semaphore slots=new Semaphore(2);
    private static final int MAX_AUDIO=4*1024*1024;

    /** Validate the trusted server configuration once; rejects external URLs/redirect targets. */
    public LocalSpeechService(@Value("${speech.local.enabled:false}") boolean enabled,
                              @Value("${speech.local.base-url:http://127.0.0.1:9880}") String baseUrl,
                              ObjectMapper mapper) {
        URI uri=URI.create(baseUrl);
        if(!"http".equals(uri.getScheme()) || !"127.0.0.1".equals(uri.getHost()) || uri.getPort()<1 || uri.getPort()>65535
            || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null
            || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))) throw new IllegalArgumentException("Local voice requires an HTTP IPv4 loopback origin with explicit port");
        this.enabled=enabled;this.endpoint=uri.resolve("/synthesize");this.mapper=mapper;
    }

    /** API-053: validate one sentence and speed, return <=4MiB WAV, or a sanitized Failure.
     * Inputs JSON text(1-80 codepoints), speed(.5-2); no state changes beyond a bounded slot.
     * Change limits with worker/browser and TEST-053; see docs/local_voice_design.md. */
    public byte[] synthesize(JsonNode input) {
        if(input==null || !input.isObject()) throw new Failure(400);
        Iterator<String> keys=input.fieldNames();while(keys.hasNext()){String key=keys.next();if(!key.equals("text")&&!key.equals("speed"))throw new Failure(400);}
        if(!input.path("text").isTextual()) throw new Failure(400);
        String text=input.get("text").textValue().trim();
        if(text.isEmpty() || text.codePointCount(0,text.length())>80)throw new Failure(400);
        for(int offset=0;offset<text.length();){int cp=text.codePointAt(offset);offset+=Character.charCount(cp);
            if((Character.isISOControl(cp)&&cp!=9&&cp!=10)||(cp>=0xd800&&cp<=0xdfff))throw new Failure(400);}
        JsonNode rawSpeed=input.get("speed");
        if(rawSpeed!=null&&!rawSpeed.isNumber())throw new Failure(400);
        double speed=rawSpeed==null?1:rawSpeed.doubleValue();
        if(!Double.isFinite(speed)||speed<.5||speed>2)throw new Failure(400);
        if(!enabled || !slots.tryAcquire())throw new Failure(503);
        HttpURLConnection connection=null;
        try {
            connection=(HttpURLConnection)endpoint.toURL().openConnection();
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(800);connection.setReadTimeout(12000);
            connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);
            ObjectNode body=mapper.createObjectNode();body.put("text",text);body.put("speed",speed);
            byte[] request=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(request.length);
            try(java.io.OutputStream output=connection.getOutputStream()){output.write(request);}
            int status=connection.getResponseCode();
            if(status!=200)throw new Failure(status==503?503:502);
            if(connection.getContentLengthLong()>MAX_AUDIO)throw new Failure(502);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream stream=connection.getInputStream()){
                byte[] buffer=new byte[8192];int count;
                while((count=stream.read(buffer))!=-1){if(bytes.size()+count>MAX_AUDIO)throw new Failure(502);bytes.write(buffer,0,count);}
            }
            byte[] wav=bytes.toByteArray();
            if(wav.length<44 || wav[0]!='R'||wav[1]!='I'||wav[2]!='F'||wav[3]!='F'||wav[8]!='W'||wav[9]!='A'||wav[10]!='V'||wav[11]!='E')throw new Failure(502);
            return wav;
        }catch(Failure failure){throw failure;}
        catch(SocketTimeoutException timeout){throw new Failure(504);}
        catch(Exception unavailable){throw new Failure(503);}
        finally{if(connection!=null)connection.disconnect();slots.release();}
    }

    /** API-053 status only: never propagate upstream text, paths or exception messages. */
    public static class Failure extends RuntimeException {
        public final int status;
        public Failure(int status){super("Local speech unavailable");this.status=status;}
    }
}
