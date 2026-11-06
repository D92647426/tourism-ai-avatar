package com.guide.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.guide.service.LocalSpeechService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.Map;

/** API-053 / REQ-053: same-origin audio, authenticated/CSRF by SecurityConfig.
 * Contract, errors, no-store and tests: docs/local_voice_design.md. */
@RestController
public class LocalSpeechController {
    private final LocalSpeechService service;
    public LocalSpeechController(LocalSpeechService service){this.service=service;}

    /** text/speed JSON -> bounded WAV; invalid/unavailable -> sanitized JSON. No history writes. */
    @PostMapping(value="/api/speech/synthesize",consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> synthesize(@RequestBody JsonNode input){
        try{return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType("audio/wav")).body(service.synthesize(input));}
        catch(LocalSpeechService.Failure failure){
            Map<String,String> error=new LinkedHashMap<>();
            error.put("code",failure.status==400?"INVALID_SPEECH":"SPEECH_UNAVAILABLE");
            error.put("message",failure.status==400?"请使用有效的短句和语速。":"角色声线暂不可用，可使用系统声音。");
            return ResponseEntity.status(failure.status).cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON).body(error);
        }
    }
}
