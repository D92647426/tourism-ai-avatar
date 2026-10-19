package com.guide.controller;

import com.guide.model.Spot;
import com.guide.service.SpotService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class SpotController {

    private final SpotService spotService;

    public SpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    @GetMapping("/spots")
    public ResponseEntity<List<Spot>> getAllSpots(
            @RequestParam(required = false) String keyword) {
        if (keyword != null && !keyword.trim().isEmpty()) {
            return ResponseEntity.ok(spotService.searchSpots(keyword));
        }
        return ResponseEntity.ok(spotService.getAllSpots());
    }

    @GetMapping("/spots/{id}")
    public ResponseEntity<?> getSpotById(@PathVariable int id) {
        Optional<Spot> spot = spotService.getSpotById(id);
        if (spot.isPresent()) {
            return ResponseEntity.ok(spot.get());
        }
        return ResponseEntity.notFound().build();
    }
}
