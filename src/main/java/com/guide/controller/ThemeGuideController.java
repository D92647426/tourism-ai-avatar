package com.guide.controller;

import com.guide.service.ThemeGuideService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** REQ-052 / API-052. Read the currently available bundled theme directory. */
@RestController
@RequestMapping("/api")
public class ThemeGuideController {
    private final ThemeGuideService themeGuideService;

    public ThemeGuideController(ThemeGuideService themeGuideService) {
        this.themeGuideService = themeGuideService;
    }

    /** REQ-052 / API-052. No input; return the available bundled theme directory, possibly empty.
     * No normal request errors. Change availability rules in ThemeGuideService.list().
     * See docs/superpowers/specs/2026-11-05-theme-guide-design.md and TEST-052. */
    @GetMapping("/themes")
    public List<ThemeGuideService.Theme> list() {
        return themeGuideService.list();
    }
}
