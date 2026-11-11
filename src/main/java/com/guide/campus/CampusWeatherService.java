package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** REQ-056 fixed Open-Meteo adapter. See docs/superpowers/specs/2026-11-09-campus-assistant-design.md.
 * Coordinates are WGS84. City fallback is a reference point, never a campus coordinate.
 * Transport, parsing and provider errors produce explicit unavailable/stale data.
 */
@Service
public class CampusWeatherService {
    public static final int CONNECT_TIMEOUT_MILLIS = 2000;
    public static final int READ_TIMEOUT_MILLIS = 3000;
    private static final long CACHE_MILLIS = 600000L;
    private static final String PROVIDER = "Open-Meteo";
    private static final String SOURCE = "https://open-meteo.com/en/docs";
    private final RestTemplate http;
    private final Clock clock;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, ObjectNode> cache = new LinkedHashMap<String, ObjectNode>(16, .75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, ObjectNode> eldest) {
            return size() > 64;
        }
    };

    /** Production transport uses bounded connect/read waits and refuses upstream redirects. */
    public CampusWeatherService() {
        this(defaultHttp(), Clock.systemUTC());
    }

    /** Inject HTTP and time for deterministic offline tests. Null dependencies are invalid. */
    public CampusWeatherService(RestTemplate http, Clock clock) {
        this.http = Objects.requireNonNull(http, "http");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** Return a detached weather snapshot. Invalid coordinate pairs throw IllegalArgumentException.
     * Successful entries last ten minutes. A failed refresh preserves the original fetch time.
     */
    public synchronized ObjectNode current(Double latitude, Double longitude) {
        validateCoordinates(latitude, longitude);
        boolean city = latitude == null;
        double lat = city ? 39.9042 : latitude;
        double lon = city ? 116.4074 : longitude;
        String key = (city ? "city:" : "position:") + lat + "," + lon;
        long now = clock.millis();
        ObjectNode previous = cache.get(key);
        if (previous != null) {
            long age = now - java.time.Instant.parse(previous.path("fetchedAt").asText()).toEpochMilli();
            if (age >= 0 && age < CACHE_MILLIS) {
                return previous.deepCopy();
            }
        }
        ObjectNode result = empty(city);
        try {
            URI uri = URI.create("https://api.open-meteo.com/v1/forecast?latitude=" + lat
                    + "&longitude=" + lon + "&current=temperature_2m,weather_code&timezone=Asia%2FShanghai");
            JsonNode body = http.execute(uri, HttpMethod.GET, null,
                    response -> mapper.readTree(readBounded(response.getBody())));
            JsonNode weather = body == null ? mapper.nullNode() : body.path("current");
            JsonNode temperature = weather.path("temperature_2m");
            JsonNode code = weather.path("weather_code");
            if (!temperature.isNumber() || !Double.isFinite(temperature.asDouble())
                    || !code.isIntegralNumber() || !code.canConvertToInt() || code.asInt() < 0 || code.asInt() > 99
                    || !weather.path("time").isTextual()) {
                throw new IllegalArgumentException("Invalid weather response");
            }
            String dataTime = weather.path("time").asText();
            LocalDateTime.parse(dataTime);
            result.put("status", "available");
            result.put("temperatureC", temperature.asDouble());
            result.put("weatherCode", code.asInt());
            result.put("time", dataTime);
            result.put("dataTime", dataTime);
            result.put("fetchedAt", clock.instant().toString());
            result.put("stale", false);
            cache.put(key, result.deepCopy());
        } catch (RuntimeException exception) {
            if (previous != null) {
                result = previous.deepCopy();
                result.put("status", "stale");
            }
            result.put("stale", true);
        }
        return result;
    }

    private ObjectNode empty(boolean city) {
        ObjectNode result = mapper.createObjectNode();
        result.put("status", "unavailable");
        result.put("label", city ? "北京市区参考天气" : "当前位置参考天气");
        result.putNull("temperatureC");
        result.putNull("weatherCode");
        result.putNull("time");
        result.putNull("dataTime");
        result.putNull("fetchedAt");
        result.put("provider", PROVIDER);
        result.put("sourceUrl", SOURCE);
        result.put("stale", true);
        return result;
    }

    private static void validateCoordinates(Double latitude, Double longitude) {
        if (latitude == null && longitude == null) {
            return;
        }
        if (latitude == null || longitude == null || !Double.isFinite(latitude)
                || !Double.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            throw new IllegalArgumentException("经纬度须同时提供有效WGS84数值，纬度范围[-90,90]，经度范围[-180,180]");
        }
    }

    private static byte[] readBounded(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (output.size() + count > 16384) {
                throw new IOException("Weather response exceeds 16 KiB");
            }
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private static RestTemplate defaultHttp() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        factory.setReadTimeout(READ_TIMEOUT_MILLIS);
        return new RestTemplate(factory);
    }
}
