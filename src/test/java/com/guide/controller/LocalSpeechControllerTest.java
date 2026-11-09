package com.guide.controller;

import com.guide.service.LocalSpeechService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** TEST-053: exact binary response and sanitized errors, without chat services. */
class LocalSpeechControllerTest {
    @Test void wavAndFailuresDoNotExposeWorkerDetails() throws Exception {
        LocalSpeechService service=mock(LocalSpeechService.class);
        MockMvc mvc=MockMvcBuilders.standaloneSetup(new LocalSpeechController(service)).build();
        byte[] audio="WAV-test".getBytes("UTF-8");when(service.synthesize(any())).thenReturn(audio);
        mvc.perform(post("/api/speech/synthesize").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"你好\"}"))
            .andExpect(status().isOk()).andExpect(content().contentType("audio/wav")).andExpect(content().bytes(audio)).andExpect(header().string("Cache-Control","no-store"));
        when(service.synthesize(any())).thenThrow(new LocalSpeechService.Failure(502));
        mvc.perform(post("/api/speech/synthesize").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"你好\"}"))
            .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("SPEECH_UNAVAILABLE"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("127.0.0.1"))));
    }
}
