package com.guide.campus;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** REQ-056 weather HTTP adapter, governed by the existing same-origin authentication filter.
 * See docs/superpowers/specs/2026-11-09-campus-assistant-design.md section 10.
 */
@RestController
public class CampusWeatherController {
    private final CampusWeatherService weather;

    public CampusWeatherController(CampusWeatherService weather) {
        this.weather = weather;
    }

    /** API GET /api/campus/weather. Optional WGS84 pair, explicit city fallback without location.
     * Invalid parameters return 400. Upstream failure returns 200 with unavailable/stale status.
     */
    @GetMapping("/api/campus/weather")
    public ObjectNode current(@RequestParam(value = "latitude", required = false) Double latitude,
                              @RequestParam(value = "longitude", required = false) Double longitude) {
        return weather.current(latitude, longitude);
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ObjectNode> invalidCoordinates(Exception exception) {
        ObjectNode error = JsonNodeFactory.instance.objectNode();
        error.put("code", "INVALID_COORDINATES");
        error.put("message", "经纬度须同时提供有效WGS84数值，纬度范围[-90,90]，经度范围[-180,180]");
        return ResponseEntity.badRequest().body(error);
    }
}
