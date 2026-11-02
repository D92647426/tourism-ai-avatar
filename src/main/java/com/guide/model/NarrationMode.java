package com.guide.model;

/**
 * REQ-046: allowlisted guide narration, not age or an inferred visitor identity.
 * Input: exact API value (null means standard); output: enum/system instruction.
 * Invalid values throw IllegalArgumentException, mapped to HTTP400 by ConversationService.
 * Change values and prompt goals here; see docs/narration_design.md, API-046/TEST-046.
 */
public enum NarrationMode {
    STANDARD("standard", "标准讲解", "自然介绍，目标200–300字，先回答当前问题。"),
    FAMILY("family", "亲子讲解", "用短句和容易理解的词语，解释必要术语，目标120–200字。一般介绍可附一个自愿回答的观察问题；门票、开放、交通问题先直接回答，不强加互动。"),
    BRIEF("brief", "精简讲解", "目标60–120字，先回答最重要的一点，省去无关栏目和重复推荐，但保留资料不确定性。必要时可以更长以避免漏掉限定条件。");

    private final String value;
    private final String label;
    private final String instruction;
    NarrationMode(String value, String label, String instruction) {
        this.value = value; this.label = label; this.instruction = instruction;
    }
    public String getValue() { return value; }
    public String getLabel() { return label; }
    public String getInstruction() { return instruction; }

    /** Parse an exact API value; null is standard, unknown/blank values throw.
     * REQ-046: allowed values and errors are documented in docs/narration_design.md. */
    public static NarrationMode parse(String value) {
        if (value == null) return STANDARD;
        for (NarrationMode mode : values()) if (mode.value.equals(value)) return mode;
        throw new IllegalArgumentException("narrationMode must be standard, family or brief");
    }
}
