import { describe, it, expect } from "vitest";
import {
  normalizeCoordinateValue,
  isValidLatitude,
  isValidLongitude,
  createCoordinatePair,
  extractCoordinatePair,
  extractCoordinatePairFromText,
  collectCoordinateSearchSources,
  haversineDistance,
  decodeValhallaShape,
  mapProfileToValhallaCosting,
  extractRoadSegments,
  buildPointLabel,
  KIMA_CENTER,
} from "../foRoutePlannerUtils";

describe("FoRoutePlanner - Utility Functions", () => {
  describe("normalizeCoordinateValue", () => {
    it("parses standard number string", () => {
      expect(normalizeCoordinateValue("-5.0929568")).toBe(-5.0929568);
    });

    it("handles comma as decimal separator", () => {
      expect(normalizeCoordinateValue("-5,0929568")).toBe(-5.0929568);
    });

    it("returns null for non-numeric input", () => {
      expect(normalizeCoordinateValue("abc")).toBeNull();
    });

    it("returns 0 for null/undefined (empty string coercion)", () => {
      expect(normalizeCoordinateValue(null)).toBe(0);
      expect(normalizeCoordinateValue(undefined)).toBe(0);
    });

    it("handles number input directly", () => {
      expect(normalizeCoordinateValue(119.5)).toBe(119.5);
    });
  });

  describe("isValidLatitude", () => {
    it("accepts valid latitude values", () => {
      expect(isValidLatitude(-5.09)).toBe(true);
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it("rejects out-of-range values", () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
    });

    it("rejects non-finite values", () => {
      expect(isValidLatitude(NaN)).toBe(false);
      expect(isValidLatitude(Infinity)).toBe(false);
    });
  });

  describe("isValidLongitude", () => {
    it("accepts valid longitude values", () => {
      expect(isValidLongitude(119.50)).toBe(true);
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it("rejects out-of-range values", () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
    });
  });

  describe("createCoordinatePair", () => {
    it("creates pair for valid coordinates", () => {
      expect(createCoordinatePair(-5.09, 119.50)).toEqual({ lat: -5.09, lng: 119.50 });
    });

    it("returns null for invalid latitude", () => {
      expect(createCoordinatePair(91, 119.50)).toBeNull();
    });

    it("returns null for invalid longitude", () => {
      expect(createCoordinatePair(-5.09, 200)).toBeNull();
    });
  });

  describe("extractCoordinatePairFromText", () => {
    it("extracts from raw lat,lng format", () => {
      expect(extractCoordinatePairFromText("-5.0929568, 119.5018379")).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("extracts from Google Maps @ format", () => {
      expect(extractCoordinatePairFromText("@-5.0929568,119.5018379,17z")).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("extracts from !3d!4d format", () => {
      expect(extractCoordinatePairFromText("!3d-5.0929568!4d119.5018379")).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("extracts from semicolon-separated format", () => {
      expect(extractCoordinatePairFromText("-5.0929568;119.5018379")).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("returns null for invalid text", () => {
      expect(extractCoordinatePairFromText("hello world")).toBeNull();
    });

    it("returns null for empty/null input", () => {
      expect(extractCoordinatePairFromText("")).toBeNull();
      expect(extractCoordinatePairFromText(null)).toBeNull();
    });
  });

  describe("extractCoordinatePair (full URL parsing)", () => {
    it("extracts from full Google Maps URL with @ format", () => {
      const url = "https://www.google.com/maps/@-5.0929568,119.5018379,17z";
      expect(extractCoordinatePair(url)).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("extracts from Google Maps URL with !3d!4d", () => {
      const url = "https://www.google.com/maps/place/KIMA/!3d-5.0929568!4d119.5018379";
      expect(extractCoordinatePair(url)).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("extracts from plain coordinate text", () => {
      expect(extractCoordinatePair("-5.0929568, 119.5018379")).toEqual({
        lat: -5.0929568,
        lng: 119.5018379,
      });
    });

    it("returns null for empty string", () => {
      expect(extractCoordinatePair("")).toBeNull();
    });

    it("returns null for URL without coordinates", () => {
      expect(extractCoordinatePair("https://www.google.com/maps")).toBeNull();
    });
  });

  describe("collectCoordinateSearchSources", () => {
    it("returns array with raw text for plain input", () => {
      const result = collectCoordinateSearchSources("-5.09, 119.50");
      expect(result).toContain("-5.09, 119.50");
    });

    it("returns empty array for empty input", () => {
      expect(collectCoordinateSearchSources("")).toEqual([]);
      expect(collectCoordinateSearchSources(null)).toEqual([]);
    });

    it("extracts query params from URL", () => {
      const url = "https://maps.google.com/maps?q=-5.09,119.50";
      const result = collectCoordinateSearchSources(url);
      expect(result.some((s) => s.includes("-5.09"))).toBe(true);
    });
  });

  describe("haversineDistance", () => {
    it("calculates distance between two points in meters", () => {
      const pointA = { lat: -5.0929568, lng: 119.5018379 };
      const pointB = { lat: -5.1000000, lng: 119.5100000 };
      const distance = haversineDistance(pointA, pointB);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(2000); // should be ~1.1km
    });

    it("returns 0 for same point", () => {
      const point = { lat: -5.09, lng: 119.50 };
      expect(haversineDistance(point, point)).toBe(0);
    });

    it("calculates KIMA center to nearby point correctly", () => {
      const kima = { lat: KIMA_CENTER[0], lng: KIMA_CENTER[1] };
      const nearby = { lat: KIMA_CENTER[0] + 0.001, lng: KIMA_CENTER[1] };
      const distance = haversineDistance(kima, nearby);
      // ~111 meters per 0.001 degree latitude
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(120);
    });
  });

  describe("decodeValhallaShape", () => {
    it("returns empty array for null/empty input", () => {
      expect(decodeValhallaShape(null)).toEqual([]);
      expect(decodeValhallaShape("")).toEqual([]);
    });

    it("returns empty array for non-string input", () => {
      expect(decodeValhallaShape(123)).toEqual([]);
    });

    it("decodes valid encoded polyline", () => {
      // Simple encoded shape test - just verify it returns array of coordinate pairs
      const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
      const result = decodeValhallaShape(encoded, 5);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((coord) => {
        expect(coord).toHaveLength(2);
        expect(typeof coord[0]).toBe("number");
        expect(typeof coord[1]).toBe("number");
      });
    });
  });

  describe("mapProfileToValhallaCosting", () => {
    it("maps 'cycling' to 'bicycle'", () => {
      expect(mapProfileToValhallaCosting("cycling")).toBe("bicycle");
    });

    it("maps 'foot' to 'pedestrian'", () => {
      expect(mapProfileToValhallaCosting("foot")).toBe("pedestrian");
    });

    it("maps 'driving' to 'auto'", () => {
      expect(mapProfileToValhallaCosting("driving")).toBe("auto");
    });

    it("defaults to 'auto' for unknown profile", () => {
      expect(mapProfileToValhallaCosting("unknown")).toBe("auto");
      expect(mapProfileToValhallaCosting(undefined)).toBe("auto");
    });
  });

  describe("extractRoadSegments", () => {
    it("extracts road segments from Valhalla legs", () => {
      const legs = [
        {
          maneuvers: [
            { street_names: ["Jl. Perintis Kemerdekaan"], length: 1.5, time: 120, instruction: "Belok kiri" },
            { street_names: ["Jl. KIMA Raya"], length: 0.8, time: 60, instruction: "Lurus" },
          ],
        },
      ];
      const result = extractRoadSegments(legs);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Jl. Perintis Kemerdekaan");
      expect(result[0].distance).toBe(1500);
      expect(result[0].duration).toBe(120);
      expect(result[1].name).toBe("Jl. KIMA Raya");
    });

    it("filters out maneuvers without street names", () => {
      const legs = [
        {
          maneuvers: [
            { street_names: ["Jl. KIMA"], length: 1, time: 60, instruction: "Lurus" },
            { street_names: [], length: 0.5, time: 30 },
            { length: 0.3, time: 20 },
          ],
        },
      ];
      const result = extractRoadSegments(legs);
      expect(result).toHaveLength(1);
    });

    it("returns empty array for null/empty legs", () => {
      expect(extractRoadSegments(null)).toEqual([]);
      expect(extractRoadSegments([])).toEqual([]);
    });

    it("handles multiple legs", () => {
      const legs = [
        { maneuvers: [{ street_names: ["Jl. A"], length: 1, time: 60, instruction: "Go" }] },
        { maneuvers: [{ street_names: ["Jl. B"], length: 2, time: 90, instruction: "Turn" }] },
      ];
      const result = extractRoadSegments(legs);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Jl. A");
      expect(result[1].name).toBe("Jl. B");
    });
  });

  describe("buildPointLabel", () => {
    it("returns point label if available", () => {
      expect(buildPointLabel({ label: "ODP KIMA" }, 0, 3)).toBe("ODP KIMA");
    });

    it("returns 'Titik A / Provider' for first point without label", () => {
      expect(buildPointLabel({}, 0, 3)).toBe("Titik A / Provider");
    });

    it("returns 'Titik B / Pelanggan' for last point without label", () => {
      expect(buildPointLabel({}, 2, 3)).toBe("Titik B / Pelanggan");
    });

    it("returns 'Waypoint Manual N' for middle points without label", () => {
      expect(buildPointLabel({}, 1, 3)).toBe("Waypoint Manual 1");
      expect(buildPointLabel({}, 2, 5)).toBe("Waypoint Manual 2");
    });

    it("trims whitespace-only labels and falls back", () => {
      expect(buildPointLabel({ label: "   " }, 0, 2)).toBe("Titik A / Provider");
    });
  });

  describe("KIMA_CENTER constant", () => {
    it("has correct KIMA coordinates", () => {
      expect(KIMA_CENTER).toEqual([-5.0929568, 119.5018379]);
    });
  });
});
