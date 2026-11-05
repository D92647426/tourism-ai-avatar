package com.guide.service;

import com.guide.model.NarrationMode;
import com.guide.model.Spot;

/** REQ-050 local organization of existing spot fields. See docs/local_followups_design.md. */
final class LocalFollowupReply {
    private static final String SUMMARY = "请把核心看点压缩为三句，方便我边走边听。";
    private static final String ANALOGY = "请用一个生活中的比喻解释最有代表性的看点，并区分比喻与史实。";
    private static final String DETAIL = "请给出一个可在现场留意的细节，并说明怎样观察；资料不足时请说明。";

    private LocalFollowupReply() { }

    /** Match an exact card question for this spot and return marked local content, or null.
     * Inputs are a resolved spot, full question and validated narration mode.
     * Retains complete field text and qualifiers. Missing fields have explicit wording.
     * No I/O or mutation; caller adds the shared sample boundary. No expected exceptions.
     * Change templates with the frontend contract in TEST-050 and docs/local_followups_design.md.
     */
    static String build(Spot spot, String question, NarrationMode mode) {
        if (spot == null || question == null) return null;
        String prefix = "关于【" + spot.getName() + "】，";
        String text = question.trim();
        String brief = field(spot.getBrief(), "目前没有收录该景点的简介，具体看点需现场核对。");
        String heading = "【" + spot.getName() + "】本地追问讲解\n\n";
        String reply;
        if (text.equals(prefix + SUMMARY)) {
            reply = heading + "一、看点（资料摘录）\n" + brief
                    + "\n\n二、类型（资料标注）\n" + field(spot.getCategory(), "目前没有收录景点类别。")
                    + "\n\n三、观察建议\n先看整体，再选一个实际可见的局部，用自己的话描述。";
        } else if (text.equals(prefix + ANALOGY)) {
            reply = heading + "资料摘录\n" + brief
                    + "\n\n帮助理解的比喻\n可以把观察景点想成翻一本图画书，先看整幅画面，再停在吸引你的局部。"
                    + "这个比喻帮助理解观察顺序，不作为景点史实。具体历史和含义仍需资料核对。";
        } else if (text.equals(prefix + DETAIL)) {
            reply = heading + "资料线索\n" + brief
                    + "\n\n现场观察建议\n1. 从你实际能看到的景物中，选一个吸引你的局部。"
                    + "\n2. 描述它的形状或相对位置，先记录看到的内容。"
                    + "\n3. 留下一个关于用途或含义的问题，再与现场说明或工作人员核对。"
                    + "\n这些步骤是观察方法，资料不足以指定某个局部的确切含义。";
        } else {
            return null;
        }
        if (mode == NarrationMode.FAMILY) reply += "\n\n可以和孩子轮流用一句话说出自己看到的内容。";
        return reply;
    }

    private static String field(String value, String missing) {
        return value == null || value.trim().isEmpty() ? missing : value;
    }
}
