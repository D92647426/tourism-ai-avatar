package com.guide.model;

/** REQ-037 / API-037: a supplied local candidate, not a verified citation.
 * Fields are immutable snapshots. Contract: docs/natural_retrieval.md.
 */
public final class KnowledgeReference {
    private final int id;
    private final String title;

    public KnowledgeReference(int id, String title) { this.id = id; this.title = title; }
    public int getId() { return id; }
    public String getTitle() { return title; }
    public String getSource() { return "local-knowledge:" + id; }
}
