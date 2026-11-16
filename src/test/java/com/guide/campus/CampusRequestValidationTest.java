package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;

/** REQ-061: route preview shares the position boundary without manufacturing a building. */
class CampusRequestValidationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void routeOriginAcceptsBoundedPlacesAndFiniteCoordinateEdges() {
        assertTrue(CampusRequestValidation.hasRouteOrigin(mapper.createObjectNode().put("placeId", "pingleyuan-library")));
        for (double[] coordinates : Arrays.asList(new double[]{0, 0}, new double[]{90, 180}, new double[]{-90, -180})) {
            assertTrue(CampusRequestValidation.hasRouteOrigin(mapper.createObjectNode()
                    .put("latitude", coordinates[0]).put("longitude", coordinates[1])));
        }
    }

    @Test void routeOriginRejectsMissingMalformedOrNonFiniteCoordinatePairs() {
        assertFalse(CampusRequestValidation.hasRouteOrigin(null));
        for (JsonNode invalid : Arrays.asList(mapper.nullNode(), mapper.createArrayNode(), mapper.createObjectNode(),
                mapper.createObjectNode().put("placeId", " "), mapper.createObjectNode().put("placeId", 123),
                mapper.createObjectNode().put("latitude", 39.875), mapper.createObjectNode().put("longitude", 116.481),
                mapper.createObjectNode().put("latitude", "39.875").put("longitude", 116.481),
                mapper.createObjectNode().put("latitude", 39.875).put("longitude", "116.481"))) {
            assertFalse(CampusRequestValidation.hasRouteOrigin(invalid));
        }
        for (double[] coordinates : Arrays.asList(new double[]{90.001, 0}, new double[]{0, -180.001},
                new double[]{Double.NaN, 0}, new double[]{0, Double.POSITIVE_INFINITY})) {
            ObjectNode invalid = mapper.createObjectNode().put("latitude", coordinates[0]).put("longitude", coordinates[1]);
            assertFalse(CampusRequestValidation.hasRouteOrigin(invalid));
        }
    }
}
