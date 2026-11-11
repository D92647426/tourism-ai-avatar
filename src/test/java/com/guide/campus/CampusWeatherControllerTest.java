package com.guide.campus;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** REQ-056 API boundary. Transport failures stay explicit, invalid coordinate input is 400. */
class CampusWeatherControllerTest {
    @Test
    void noLocationReturnsClearlyLabeledUnavailableCityWeather() throws Exception {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer upstream = MockRestServiceServer.bindTo(http).build();
        upstream.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/v1/forecast?")))
                .andRespond(withServerError());
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new CampusWeatherController(new CampusWeatherService(http, Clock.systemUTC()))).build();
        mvc.perform(get("/api/campus/weather"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("unavailable"))
                .andExpect(jsonPath("$.label").value("北京市区参考天气"))
                .andExpect(jsonPath("$.stale").value(true))
                .andExpect(jsonPath("$.provider").value("Open-Meteo"));
        upstream.verify();
    }

    @Test
    void invalidCoordinatesAreRejectedBeforeAnyUpstreamCall() throws Exception {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer upstream = MockRestServiceServer.bindTo(http).build();
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new CampusWeatherController(new CampusWeatherService(http, Clock.systemUTC()))).build();
        for (String query : new String[]{"?latitude=40", "?longitude=116", "?latitude=NaN&longitude=116",
                "?latitude=91&longitude=116", "?latitude=40&longitude=181", "?latitude=oops&longitude=116"}) {
            mvc.perform(get("/api/campus/weather" + query))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_COORDINATES"));
        }
        upstream.verify();
    }
}
