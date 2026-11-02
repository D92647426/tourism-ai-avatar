package com.guide.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.KnowledgeItem;
import com.guide.model.KnowledgeReference;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/** REQ-037: deterministic entity/alias/keyword retrieval with bounded supplied context.
 * No network or mutable session state. Rules and tuning point: docs/natural_retrieval.md.
 */
public final class KnowledgeRetriever {
    public static final int MAX_CONTEXT_CHARS = 1200;
    private static final int MAX_MATCHES = 3, MAX_TITLE = 80, MAX_BODY = 200;
    private static final String HEADER = "【知识库参考资料】\n（本地课程示例，未核验；K编号仅用于定位本地条目。）\n";
    private static final Set<String> GENERIC = new HashSet<>(Arrays.asList(
            "它", "故事", "历史", "来历", "起源", "介绍", "那个", "寺庙", "景点", "景区", "资料"));
    private final Dictionary dictionary;

    /** Load the curated packaged dictionary once. Invalid packaged data fails startup.
     * @throws IllegalStateException missing or invalid dictionary; no remote fallback.
     */
    public KnowledgeRetriever() {
        try (InputStream in = new ClassPathResource("retrieval-entities.json").getInputStream()) {
            dictionary = new ObjectMapper().readValue(in, Dictionary.class);
            Set<String> names = new HashSet<>();
            if (dictionary == null || dictionary.entities == null || dictionary.excludedNames == null) {
                throw new IllegalArgumentException("Missing dictionary fields");
            }
            for (Entity entity : dictionary.entities) {
                if (entity == null || normalize(entity.name).isEmpty() || entity.aliases == null || !names.add(entity.name)) {
                    throw new IllegalArgumentException("Invalid or duplicate entity");
                }
                for (String alias : entity.aliases) {
                    if (normalize(alias).length() < 2) throw new IllegalArgumentException("Alias too short");
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            throw new IllegalStateException("Invalid packaged retrieval-entities.json", e);
        }
    }

    /** REQ-037: retrieve a detached result from the supplied current library.
     * Empty/unrelated/ambiguous input yields no context/references; recognized names may
     * still enable scenic fallback. At most 3 candidates and 1200 context characters.
     * Inputs may contain null rows/fields; those rows are skipped, not invented.
     * @see docs/natural_retrieval.md
     */
    public KnowledgeRetrieval retrieve(String question, List<KnowledgeItem> library) {
        String query = normalize(question);
        final String masked = maskExcluded(query);
        List<Entity> entities = dictionary.entities.stream().filter(e -> firstMention(masked, e) >= 0)
                .sorted(Comparator.comparingInt(e -> firstMention(masked, e))).collect(Collectors.toList());
        List<Candidate> ranked = new ArrayList<>();
        if (!query.isEmpty() && library != null) for (KnowledgeItem item : library) {
            if (item == null || item.getId() <= 0 || item.getTitle() == null || item.getContent() == null) continue;
            Candidate candidate = score(query, masked, entities, item);
            if (candidate.score > 0) ranked.add(candidate);
        }
        ranked.sort(Comparator.comparingInt((Candidate c) -> c.score).reversed()
                .thenComparingInt(c -> c.item.getId()).thenComparing(c -> c.item.getTitle()));
        List<Candidate> selected = new ArrayList<>();
        // Give each explicitly requested entity a primary candidate before filling slots.
        for (Entity entity : entities) {
            for (Candidate candidate : ranked) {
                if (strength(candidate.item, entity) >= 100) { addUnique(selected, candidate); break; }
            }
        }
        for (Candidate candidate : ranked) addUnique(selected, candidate);
        StringBuilder context = new StringBuilder(HEADER);
        List<KnowledgeReference> references = new ArrayList<>();
        for (Candidate candidate : selected) {
            String title = clip(candidate.item.getTitle(), MAX_TITLE);
            String line = "- [" + title + "] " + clip(candidate.item.getContent(), MAX_BODY)
                    + " 【资料 K" + candidate.item.getId() + "】\n";
            if (context.length() + line.length() > MAX_CONTEXT_CHARS) continue;
            context.append(line);
            references.add(new KnowledgeReference(candidate.item.getId(), title));
        }
        return new KnowledgeRetrieval(references.isEmpty() ? "" : context.toString(), references,
                entities.stream().map(e -> e.name).collect(Collectors.toList()));
    }

    /** REQ-046: prevent an explicitly excluded namesake from inheriting current-spot facts.
     * Input may be null; output is a dictionary scope hint, not open-world place recognition.
     * No retrieval/storage/network. Tune excludedNames in retrieval-entities.json; TEST-046. */
    public boolean mentionsExcludedName(String question) {
        String query = normalize(question);
        return dictionary.excludedNames.stream().anyMatch(name -> query.contains(normalize(name)));
    }

    private Candidate score(String query, String localQuery, List<Entity> entities, KnowledgeItem item) {
        int terms = 0;
        String title = normalize(item.getTitle());
        boolean localTitle = localQuery.length() >= 2 && !GENERIC.contains(localQuery)
                && (title.contains(localQuery) || (title.length() >= 2 && !GENERIC.contains(title) && localQuery.contains(title)));
        if (localTitle || (isExcludedName(title) && query.contains(title))) terms += 80;
        for (String term : keywords(item)) {
            if (term.length() >= 2 && !GENERIC.contains(term)
                    && (localQuery.contains(term) || (isExcludedName(term) && query.contains(term)))) {
                terms += 30 + Math.min(term.length(), 20);
            }
        }
        if ((query.equals("待补充") || query.equals("原始正文缺失")) && normalize(item.getContent()).contains(query)) terms += 30;
        int entityScore = 0;
        boolean primary = false;
        for (Entity entity : entities) {
            int contribution = strength(item, entity);
            entityScore += contribution;
            primary |= contribution >= 100;
        }
        // A mention in a route/body alone is not sufficient for a scenic history question.
        boolean eligible = entities.isEmpty() ? terms > 0 : primary || (entityScore > 0 && terms > 0);
        return new Candidate(item, eligible ? entityScore + terms : 0);
    }

    private int strength(KnowledgeItem item, Entity entity) {
        String title = normalize(item.getTitle()), body = normalize(item.getContent());
        List<String> names = new ArrayList<>(entity.aliases); names.add(entity.name);
        for (String name : names) if (title.contains(normalize(name))) return 300;
        Set<String> keywords = keywords(item);
        for (String name : names) if (keywords.contains(normalize(name))) return 180;
        return body.contains(normalize(entity.name)) ? 20 : 0;
    }

    private static Set<String> keywords(KnowledgeItem item) {
        Set<String> words = new LinkedHashSet<>();
        if (item.getKeywords() != null) for (String term : item.getKeywords().split("[,，、;；\\s]+")) words.add(normalize(term));
        return words;
    }

    /** Remove explicit external names before short local alias/title/keyword matching.
     * An exact external title/keyword may still retrieve a genuinely named reference.
     */
    private String maskExcluded(String query) {
        for (String excluded : dictionary.excludedNames) query = query.replace(normalize(excluded), "");
        return query;
    }
    private boolean isExcludedName(String term) {
        return dictionary.excludedNames.stream().anyMatch(name -> normalize(name).equals(term));
    }

    private static void addUnique(List<Candidate> selected, Candidate candidate) {
        if (selected.size() < MAX_MATCHES && selected.stream().noneMatch(c -> c.item.getId() == candidate.item.getId())) selected.add(candidate);
    }
    private static int firstMention(String query, Entity entity) {
        int first = query.indexOf(normalize(entity.name));
        for (String alias : entity.aliases) {
            int index = query.indexOf(normalize(alias));
            if (index >= 0 && (first < 0 || index < first)) first = index;
        }
        return first;
    }
    private static String normalize(String text) {
        return text == null ? "" : Normalizer.normalize(text, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT).replaceAll("[\\p{P}\\p{Z}\\s]+", "");
    }
    private static String clip(String text, int limit) {
        if (text.length() <= limit) return text;
        int end = Character.isHighSurrogate(text.charAt(limit - 1)) ? limit - 1 : limit;
        return text.substring(0, end);
    }
    private static final class Candidate {
        final KnowledgeItem item; final int score;
        Candidate(KnowledgeItem item, int score) { this.item = item; this.score = score; }
    }
    /** Jackson-only packaged dictionary shape; aliases are explicit editorial decisions. */
    public static final class Dictionary {
        public List<String> excludedNames;
        public List<Entity> entities;
    }
    public static final class Entity {
        public String name;
        public List<String> aliases;
    }
}
