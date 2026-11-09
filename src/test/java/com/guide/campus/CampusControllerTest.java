package com.guide.campus;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.service.AiCompletionClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import javax.servlet.http.Cookie;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP shapes plus the same CookieCsrfTokenRepository used by SecurityConfig. */
class CampusControllerTest {
    private MockMvc mvc;
    private final ObjectMapper mapper = new ObjectMapper();
    @BeforeEach void setup() {
        CampusCatalog catalog = new CampusCatalog();
        CampusAssistantService service = new CampusAssistantService(catalog,
                new AiCompletionClient("", "http://127.0.0.1", "test"), new CampusWeatherService());
        mvc = MockMvcBuilders.standaloneSetup(new CampusAssistantController(catalog, service))
                .addFilters(new CsrfFilter(CookieCsrfTokenRepository.withHttpOnlyFalse())).build();
    }

    @Test void catalogContextChatNewAndCancelRetainCsrfAndSessionBoundaries() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(get("/api/campus/catalog")).andExpect(status().isOk()).andExpect(jsonPath("$.places").isArray());
        MvcResult current = mvc.perform(get("/api/campus/context").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.serverTime").isString()).andExpect(jsonPath("$.timezone").value("Asia/Shanghai")).andReturn();
        ObjectNode request = (ObjectNode) mapper.readTree(current.getResponse().getContentAsByteArray());
        request.put("requestId", "http-1").put("message", "平乐园补卡");
        mvc.perform(post("/api/campus/chat").session(session).contentType("application/json").content(request.toString()))
                .andExpect(status().isForbidden());
        Cookie cookie = current.getResponse().getCookie("XSRF-TOKEN");
        mvc.perform(post("/api/campus/chat").session(session).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType("application/json").content(request.toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("local")).andExpect(jsonPath("$.contextRevision").value(1))
                .andExpect(jsonPath("$.sceneAction.taskId").value("campus-card"));
        mvc.perform(post("/api/campus/chat").session(session).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType("application/json").content(request.deepCopy().put("requestId", "stale").toString()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_CONTEXT"));
        mvc.perform(post("/api/campus/cancel").session(session).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType("application/json").content(request.deepCopy().put("requestId", "next").toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.canceled").value(true));
        mvc.perform(post("/api/campus/new").session(session).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.contextRevision").value(0));
        mvc.perform(post("/api/campus/chat").session(session).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue())
                .contentType("application/json").content("[]")).andExpect(status().isBadRequest());
    }
}
