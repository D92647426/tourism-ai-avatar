package com.guide.campus;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;

/** Campus demo Task 1. Verified facts are exposed through the catalog query boundary. */
class CampusCatalogTest {
    @Test
    void listsFiveCurrentCampusesAndTheirPublishedAddresses() {
        CampusCatalog catalog = new CampusCatalog();
        assertEquals(5, catalog.snapshot().path("campuses").size());
        assertEquals("校本部（平乐园）", catalog.campus("pingleyuan").path("name").asText());
        assertEquals("朝阳区平乐园100号", catalog.campus("pingleyuan").path("address").asText());
        assertNotNull(catalog.campus("tongzhou"));
        assertNotNull(catalog.campus("guanzhuang"));
        assertNotNull(catalog.campus("liulijing"));
        assertNotNull(catalog.campus("huixin-east"));
        assertNull(catalog.campus("zhonglan"));
    }

    @Test
    void distinguishesLibraryNamesAcrossCampusesAndKeepsUnverifiedCoordinatesUnknown() {
        CampusCatalog catalog = new CampusCatalog();
        List<ObjectNode> libraries = catalog.searchPlaces("图书馆", null);
        assertEquals(3, libraries.size());
        assertEquals("pingleyuan-library", catalog.searchPlaces("图书馆", "pingleyuan")
                .get(0).path("id").asText());
        assertEquals("逸夫图书馆", catalog.place("pingleyuan-library").path("name").asText());
        assertEquals(2, catalog.searchPlaces("图书馆", "tongzhou").size());
        assertEquals("汲学馆", catalog.place("tongzhou-jixue-library").path("name").asText());
        assertEquals("耕园馆", catalog.place("tongzhou-gengyuan-library").path("name").asText());
        assertEquals("pingleyuan-fourth-teaching", catalog.searchPlaces("想去四教看看", "pingleyuan")
                .get(0).path("id").asText());
        assertTrue(catalog.searchPlaces("图书馆", "unknown").isEmpty());
        assertTrue(catalog.searchPlaces("", "pingleyuan").size() >= 20);
        for (ObjectNode place : catalog.searchPlaces(null, null)) {
            assertEquals("unverified", place.path("coordinateStatus").asText());
            assertTrue(place.get("coordinates").isNull(), place.path("id").asText());
            assertFalse(place.path("sourceUrl").asText().isEmpty());
        }
        assertNull(catalog.place("unknown"));
    }

    @Test
    void prioritizesSpecificRoomAliasesAndNormalizesFullWidthCharactersAndWhitespace() {
        CampusCatalog catalog = new CampusCatalog();
        assertEquals("pingleyuan-swimming-207", catalog.searchPlaces("想去游泳馆２０７室", "pingleyuan")
                .get(0).path("id").asText());
        assertEquals("pingleyuan-fourth-teaching", catalog.searchPlaces(" 四 教 ", "pingleyuan")
                .get(0).path("id").asText());
        assertNull(catalog.place(null));
        assertNull(catalog.campus(null));
        assertNull(catalog.task(null));
    }

    @Test
    void separatesCardAndLibraryPurposesAndRequestsClarificationForAmbiguousSportsSignIn() {
        CampusCatalog catalog = new CampusCatalog();
        ObjectNode card = catalog.task("campus-card");
        assertTrue(card.path("aliases").toString().contains("学生卡"));
        assertTrue(card.path("variants").get(0).path("steps").toString().contains("学生证"));
        assertEquals("pingleyuan-card-service", card.path("variants").get(0).path("placeId").asText());
        assertTrue(catalog.place("pingleyuan-card-service").path("address").asText()
                .contains("学综楼4层一站式服务大厅1—3号窗口"));
        assertTrue(card.path("variants").get(0).path("unknownFields").toString().contains("openingHours"));
        assertTrue(card.path("variants").get(1).get("placeId").isNull());
        assertEquals("tongzhou", card.path("variants").get(1).path("campusId").asText());
        assertNotNull(catalog.task("library-study"));
        assertNotNull(catalog.task("library-discussion"));
        assertNotNull(catalog.task("library-borrow"));
        assertNotNull(catalog.task("library-computer"));
        assertTrue(catalog.task("library-discussion").path("variants").get(0)
                .path("steps").toString().contains("刷校园卡签到"));
        assertTrue(catalog.task("library-computer").path("variants").get(0)
                .path("steps").toString().contains("北区一层西侧"));
        ObjectNode sports = catalog.task("sports-sign-in");
        assertTrue(sports.path("aliases").toString().contains("体测签到"));
        assertTrue(sports.path("variants").get(0).get("placeId").isNull());
        assertTrue(sports.path("variants").get(0).path("steps").toString().contains("课程考勤"));
        assertTrue(catalog.task("fitness-exemption-2026").path("variants").get(0)
                .path("steps").toString().contains("2026年11月26、27日"));
        assertNull(catalog.task("unknown"));
    }

    @Test
    void everyVisitorApplicableLibraryVariantIncludesEntryPrerequisitesAndTheirSource() {
        int visitorVariants = 0;
        for (JsonNode task : new CampusCatalog().snapshot().path("tasks")) {
            if (!task.path("id").asText().startsWith("library-")) {
                continue;
            }
            for (JsonNode variant : task.path("variants")) {
                if (!includesAudience(variant, "alumni") && !includesAudience(variant, "visitor")) {
                    continue;
                }
                visitorVariants++;
                String id = variant.path("id").asText();
                String steps = variant.path("steps").toString();
                assertTrue(steps.contains("校友证明与身份证"), id);
                assertTrue(steps.contains("核验登记"), id);
                assertTrue(steps.contains("提前申请批准备案后凭身份证登记"), id);
                assertTrue(steps.contains("校门入校规则另查"), id);
                assertTrue(steps.contains("借阅资格需另行核实"), id);
                assertTrue(variant.path("sourceRefs").isArray(), id);
                assertTrue(variant.path("sourceRefs").findValuesAsText("url")
                        .contains("https://lib.bjut.edu.cn/info/1147/1005.htm"), id);
            }
        }
        assertTrue(visitorVariants > 0);
    }

    @Test
    void rejectsMalformedSupplementarySourcesAndUnsafeReferenceUrls() {
        assertRejected(root -> firstVariant(root).put("sourceRefs", "invalid"), "sourceRefs");
        assertRejected(root -> firstVariant(root).putArray("sourceRefs").add("invalid"), "sourceRefs");
        assertRejected(root -> firstVariant(root).putArray("sourceRefs").addObject()
                .put("url", "https://lib.bjut.edu.cn/info/1147/1005.htm"), "title");
        assertRejected(root -> firstVariant(root).putArray("sourceRefs").addObject()
                .put("title", "图书馆入馆须知"), "url");
        assertRejected(root -> firstVariant(root).putArray("sourceRefs").addObject()
                .put("title", "图书馆入馆须知").put("url", "javascript:alert(1)"), "sourceRefs");
        assertRejected(root -> firstVariant(root).putArray("sourceRefs").addObject()
                .put("title", "图书馆入馆须知").put("url", "/relative"), "sourceRefs");
        assertRejected(root -> firstVariant(root).putArray("sourceRefs").addObject()
                .put("title", "图书馆入馆须知").put("url", "https:///no-host"), "sourceRefs");
    }

    @Test
    void linksCampusPhotosToTheirBuildingsAndRecordsUnpublishedReusePermission() {
        CampusCatalog catalog = new CampusCatalog();
        JsonNode assets = catalog.snapshot().path("assets");
        assertEquals(8, assets.size());
        assertEquals(26, catalog.snapshot().path("places").size());
        for (JsonNode asset : assets) {
            assertTrue(asset.path("path").asText().startsWith("/media/campus/"));
            assertTrue(asset.path("sourceUrl").asText().startsWith("https://"));
            assertEquals("upstream-unspecified", asset.path("license").asText());
            assertFalse(asset.path("alt").asText().isEmpty());
            assertTrue(java.util.Arrays.asList("character", "photo", "floorplan").contains(asset.path("kind").asText()));
            if (!asset.path("placeId").isNull()) {
                assertTrue(catalog.place(asset.path("placeId").asText()).path("assetIds").toString()
                        .contains(asset.path("id").asText()));
            }
        }
        assertEquals("library-exterior", catalog.place("pingleyuan-library")
                .path("assetIds").get(0).asText());
        assertTrue(catalog.place("pingleyuan-library-discussion-rooms").path("assetIds").isEmpty());
        assertTrue(catalog.place("pingleyuan-library").path("assetIds").toString().contains("library-floorplan-1"));
        assertTrue(catalog.place("pingleyuan-tiantian-dining").path("assetIds").toString().contains("tiantian-dining-photo"));
        assertTrue(catalog.place("pingleyuan-north-dining").path("assetIds").toString().contains("north-dining-photo"));
        JsonNode map = catalog.campus("pingleyuan").path("mapPreview");
        assertEquals("WGS84", map.path("coordinateSystem").asText());
        assertEquals(26, map.path("boundary").size());
        assertEquals(4, map.path("bbox").size());
        assertEquals("ODbL-1.0", map.path("license").asText());
        assertEquals("https://www.openstreetmap.org/way/33617299", map.path("sourceUrl").asText());
    }

    @Test
    void modifyingAnyReturnedRecordOrNestedCollectionCannotChangeTheCatalog() {
        CampusCatalog catalog = new CampusCatalog();
        catalog.snapshot().withArray("campuses").removeAll();
        catalog.campus("pingleyuan").put("name", "changed");
        catalog.place("pingleyuan-library").withArray("aliases").removeAll();
        catalog.task("campus-card").withArray("variants").removeAll();
        List<ObjectNode> results = catalog.searchPlaces("图书馆", "pingleyuan");
        results.get(0).put("name", "changed");
        results.get(0).withArray("assetIds").removeAll();
        results.clear();
        assertEquals(5, catalog.snapshot().path("campuses").size());
        assertEquals("校本部（平乐园）", catalog.campus("pingleyuan").path("name").asText());
        assertEquals("逸夫图书馆", catalog.place("pingleyuan-library").path("name").asText());
        assertFalse(catalog.place("pingleyuan-library").path("aliases").isEmpty());
        assertFalse(catalog.place("pingleyuan-library").path("assetIds").isEmpty());
        assertFalse(catalog.task("campus-card").path("variants").isEmpty());
    }

    @Test
    void rejectsDuplicateIdsIncludingServiceVariantsAndIdsAcrossCollections() {
        for (String collection : new String[]{"campuses", "places", "tasks", "assets"}) {
            assertRejected(root -> root.withArray(collection).add(root.path(collection).get(0).deepCopy()),
                    "Duplicate id");
        }
        assertRejected(root -> ((ArrayNode) root.path("tasks").get(0).path("variants"))
                .add(root.path("tasks").get(0).path("variants").get(0).deepCopy()), "Duplicate id");
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).put("id", "pingleyuan"),
                "Duplicate id");
    }

    @Test
    void rejectsUnknownReferencesAndTaskDestinationsInAnotherCampus() {
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).put("campusId", "missing"),
                "Unknown campus");
        assertRejected(root -> firstVariant(root).put("campusId", "missing"), "Unknown campus");
        assertRejected(root -> firstVariant(root).put("placeId", "missing"), "Unknown place");
        assertRejected(root -> firstVariant(root).put("placeId", "tongzhou-jixue-library"), "Cross-campus");
        assertRejected(root -> ((ObjectNode) root.path("assets").get(1)).put("placeId", "missing"),
                "Unknown place");
    }

    @Test
    void rejectsMissingOrUnsafeSourceUrlsAtEverySourceBearingRecord() {
        assertRejected(root -> ((ObjectNode) root.path("campuses").get(0)).remove("sourceUrl"), "sourceUrl");
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).put("sourceUrl", "/relative"), "sourceUrl");
        assertRejected(root -> firstVariant(root).put("sourceUrl", "javascript:alert(1)"), "sourceUrl");
        assertRejected(root -> ((ObjectNode) root.path("assets").get(0)).put("sourceUrl", "https:///no-host"),
                "sourceUrl");
    }

    @Test
    void rejectsBrokenOrMisleadingAssetAssociationsAndUnsafeLocalPaths() {
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).withArray("assetIds").add("missing"),
                "Unknown asset");
        assertRejected(root -> ((ObjectNode) root.path("places").get(1)).withArray("assetIds")
                .add("library-exterior"), "Asset association");
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).withArray("assetIds").removeAll(),
                "Asset association");
        assertRejected(root -> ((ObjectNode) root.path("assets").get(1)).put("placeId", "pingleyuan-moon-lake"),
                "Asset association");
        assertRejected(root -> ((ObjectNode) root.path("assets").get(0)).put("path", "/media/campus/../secret"),
                "path");
    }

    @Test
    void rejectsInvalidShapeMissingFieldsAndInventedUnverifiedCoordinates() {
        assertRejected(root -> root.put("places", "invalid"), "places");
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).put("id", " "), "id");
        assertRejected(root -> ((ObjectNode) root.path("assets").get(0)).remove("license"), "license");
        assertRejected(root -> ((ObjectNode) root.path("places").get(0)).putObject("coordinates")
                .put("latitude", 39.87).put("longitude", 116.48), "coordinates");
        assertThrows(IllegalStateException.class, () -> new CampusCatalog((java.io.InputStream) null));
        assertThrows(IllegalStateException.class, () -> new CampusCatalog(new ByteArrayInputStream(
                "invalid-json".getBytes(StandardCharsets.UTF_8))));
    }

    private ObjectNode firstVariant(ObjectNode root) {
        return (ObjectNode) root.path("tasks").get(0).path("variants").get(0);
    }

    private boolean includesAudience(JsonNode variant, String audience) {
        for (JsonNode value : variant.path("audiences")) {
            if (audience.equals(value.asText())) {
                return true;
            }
        }
        return false;
    }

    private void assertRejected(Consumer<ObjectNode> mutation, String message) {
        ObjectNode root = new CampusCatalog().snapshot();
        mutation.accept(root);
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new CampusCatalog(new ByteArrayInputStream(root.toString().getBytes(StandardCharsets.UTF_8))));
        assertTrue(exception.getMessage().contains(message), exception.getMessage());
    }
}
