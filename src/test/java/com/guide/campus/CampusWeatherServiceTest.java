package com.guide.campus;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;

/** REQ-056 weather public seam, using a fake upstream and clock only. */
class CampusWeatherServiceTest {
    private static final String WEATHER = "{\"current\":{\"temperature_2m\":12.5,\"weather_code\":3,\"time\":\"2026-11-09T12:00\"}}";
    @Test
    void cityReferenceHasSourceTimesAndDetachedTenMinuteCache() {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
        server.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current=temperature_2m,weather_code&timezone=Asia%2FShanghai"))
                .andRespond(withSuccess("{\"current\":{\"temperature_2m\":12.5,\"weather_code\":3,\"time\":\"2026-11-09T12:00\"}}", MediaType.APPLICATION_JSON));
        CampusWeatherService service = new CampusWeatherService(http,
                Clock.fixed(Instant.parse("2026-11-09T04:00:00Z"), ZoneOffset.UTC));

        ObjectNode result = service.current(null, null);
        assertEquals("available", result.path("status").asText());
        assertEquals("北京市区参考天气", result.path("label").asText());
        assertEquals(12.5, result.path("temperatureC").asDouble());
        assertEquals("2026-11-09T12:00", result.path("dataTime").asText());
        assertEquals("2026-11-09T04:00:00Z", result.path("fetchedAt").asText());
        assertFalse(result.path("stale").asBoolean());
        result.put("temperatureC", 99);
        assertEquals(12.5, service.current(null, null).path("temperatureC").asDouble());
        server.verify();
    }

    @Test
    void refreshAtTenMinutesKeepsStaleDataOnNetworkFailureAndRecovers() {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
        server.expect(requestTo(org.hamcrest.Matchers.containsString("latitude=40.0&longitude=116.0")))
                .andRespond(withSuccess(WEATHER, MediaType.APPLICATION_JSON));
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/")))
                .andRespond(withException(new IOException("offline")));
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/")))
                .andRespond(withSuccess(WEATHER.replace("12.5", "13.5"), MediaType.APPLICATION_JSON));
        MutableClock clock = new MutableClock();
        CampusWeatherService service = new CampusWeatherService(http, clock);
        assertEquals("available", service.current(40.0, 116.0).path("status").asText());
        clock.advance(599999);
        assertFalse(service.current(40.0, 116.0).path("stale").asBoolean());
        clock.advance(1);
        ObjectNode stale = service.current(40.0, 116.0);
        assertEquals("stale", stale.path("status").asText());
        assertEquals(12.5, stale.path("temperatureC").asDouble());
        assertTrue(stale.path("stale").asBoolean());
        assertEquals("2026-11-09T04:00:00Z", stale.path("fetchedAt").asText());
        assertEquals(13.5, service.current(40.0, 116.0).path("temperatureC").asDouble());
        server.verify();
    }

    @Test
    void malformedOversizedAndInvalidProviderPayloadsAreUnavailable() {
        for (String body : new String[]{"invalid", "{}", WEATHER.replace("12.5", "null"),
                WEATHER.replace("2026-11-09T12:00", "unknown"), WEATHER.replace("3,", "4294967299,"),
                new String(new char[17000]).replace('\0', 'x')}) {
            RestTemplate http = new RestTemplate();
            MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
            server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.open-meteo.com/")))
                    .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
            ObjectNode result = new CampusWeatherService(http, new MutableClock()).current(null, null);
            assertEquals("unavailable", result.path("status").asText(), body.substring(0, Math.min(100, body.length())));
            assertTrue(result.path("temperatureC").isNull());
            assertTrue(result.path("stale").asBoolean());
            server.verify();
        }
    }

    @Test
    void allInvalidCoordinatePairsFailWithoutNetwork() {
        CampusWeatherService service = new CampusWeatherService(new RestTemplate(), new MutableClock());
        for (Double[] pair : new Double[][]{{null, 116.0}, {40.0, null}, {Double.NaN, 116.0},
                {40.0, Double.POSITIVE_INFINITY}, {-91.0, 116.0}, {40.0, -181.0}}) {
            assertThrows(IllegalArgumentException.class, () -> service.current(pair[0], pair[1]));
        }
    }

    private static class MutableClock extends Clock {
        private Instant instant = Instant.parse("2026-11-09T04:00:00Z");
        void advance(long millis) {instant = instant.plusMillis(millis);}
        @Override public ZoneId getZone() {return ZoneOffset.UTC;}
        @Override public Clock withZone(ZoneId zone) {return this;}
        @Override public Instant instant() {return instant;}
    }
}
