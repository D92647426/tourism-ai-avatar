package com.guide.service;

import com.guide.model.KnowledgeReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** REQ-037: immutable result shared by model context, fallback and response references.
 * See docs/natural_retrieval.md; the entity names describe this query, not a session.
 */
public final class KnowledgeRetrieval {
    private final String context;
    private final List<KnowledgeReference> references;
    private final List<String> entityNames;

    public KnowledgeRetrieval(String context, List<KnowledgeReference> references, List<String> entityNames) {
        this.context = context;
        this.references = Collections.unmodifiableList(new ArrayList<>(references));
        this.entityNames = Collections.unmodifiableList(new ArrayList<>(entityNames));
    }
    public String getContext() { return context; }
    public List<KnowledgeReference> getReferences() { return references; }
    public List<String> getEntityNames() { return entityNames; }
}
