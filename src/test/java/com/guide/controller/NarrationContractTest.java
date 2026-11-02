package com.guide.controller;

import com.guide.model.ChatResponse;
import com.guide.service.ChatService;
import com.guide.service.ConversationService;
import com.guide.service.SpotService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** TEST-046: actual JSON contract, not a controller mock accepting arbitrary modes. */
class NarrationContractTest {
    @Test void acceptsFamilyAndRejectsUnknownMode() throws Exception {
        ChatService chat = mock(ChatService.class);
        when(chat.chat(anyString(), any(), anyList(), any(), any())).thenReturn(new ChatResponse("介绍",true));
        org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders.standaloneSetup(new ChatController(
                new ConversationService(chat,mock(SpotService.class)))).build();
        mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"介绍\",\"narrationMode\":\"family\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.narrationMode").value("family"));
        mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"介绍\",\"narrationMode\":\"invent\"}"))
                .andExpect(status().isBadRequest());
    }
}
