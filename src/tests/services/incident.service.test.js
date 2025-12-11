
// src/tests/incident.service.test.js
import { jest } from "@jest/globals";

// -----------------------------
// Silence console.error during tests
// -----------------------------
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

// -----------------------------
// Fixed "now" for UTC month boundaries used by the service
// Example: October 15, 2025 UTC
// -----------------------------
jest.useFakeTimers().setSystemTime(new Date("2025-10-15T12:00:00Z"));

// -----------------------------
// Mock Incident model (ESM-friendly) with collection.aggregate().toArray()
// -----------------------------
let aggregateMock;
let toArrayMock;

await jest.unstable_mockModule("../../models/incident.model", () => {
  aggregateMock = jest.fn();
  toArrayMock = jest.fn();
  return {
    default: {
      collection: {
        aggregate: aggregateMock,
      },
    },
  };
});

// -----------------------------
// Mock ApiError class used by the service
// -----------------------------
await jest.unstable_mockModule("../../utils/ApiError", () => ({
  ApiError: class ApiError extends Error {
    constructor(statusCode, message) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

// Import AFTER registering all mocks
const Incident = (await import("../../models/incident.model")).default;
const { ApiError } = await import("../../utils/ApiError");
const { getTotalIncidents } = await import("../../services/incident.service.js");

describe("getTotalIncidents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  test("throws ApiError(400) when customerName is missing or invalid", async () => {
    await expect(getTotalIncidents("")).rejects.toBeInstanceOf(ApiError);
    await expect(getTotalIncidents("   ")).rejects.toBeInstanceOf(ApiError);
    await expect(getTotalIncidents(undefined)).rejects.toBeInstanceOf(ApiError);
    await expect(getTotalIncidents(null)).rejects.toBeInstanceOf(ApiError);
    await expect(getTotalIncidents(123)).rejects.toBeInstanceOf(ApiError);

    // The first rejection should carry 400 and message "customerName is required"
    try {
      await getTotalIncidents("");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("customerName is required");
    }
  });

  test("returns totals from aggregation when incidents exist in the current month", async () => {
    // Arrange: make aggregate return a cursor whose toArray yields one doc
    aggregateMock.mockReturnValue({ toArray: toArrayMock });
    toArrayMock.mockResolvedValue([{ total: 5, open: 2, closed: 3 }]);

    const result = await getTotalIncidents("Contoso");

    // Verify aggregate has been called with a pipeline that includes the month filter
    expect(aggregateMock).toHaveBeenCalledTimes(1);
    const pipeline = aggregateMock.mock.calls[0][0];

    // Basic pipeline shape assertions
    expect(Array.isArray(pipeline)).toBe(true);
    expect(pipeline[0]).toMatchObject({ $match: { customer_name: "Contoso".trim() } });
    // The second $match should constrain createdAt with $gte/$lte (monthStart/monthEnd)
    const monthFilterStage = pipeline.find((st) => "$match" in st && st.$match.createdAt);
    expect(monthFilterStage.$match.createdAt).toHaveProperty("$gte");
    expect(monthFilterStage.$match.createdAt).toHaveProperty("$lte");

    expect(result).toEqual({ total: 5, open: 2, closed: 3 });
  });

  test("returns zeros when aggregation yields no documents (no incidents this month)", async () => {
    aggregateMock.mockReturnValue({ toArray: toArrayMock });
    toArrayMock.mockResolvedValue([]); // empty array → no incidents

    const result = await getTotalIncidents("Fabrikam");

    expect(result).toEqual({ total: 0, open: 0, closed: 0 });
  });

  test("wraps unexpected DB errors into ApiError(500)", async () => {
    aggregateMock.mockReturnValue({ toArray: toArrayMock });
    toArrayMock.mockRejectedValue(new Error("DB failed"));

    await expect(getTotalIncidents("ACME")).rejects.toBeInstanceOf(ApiError);

    try {
      await getTotalIncidents("ACME");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toMatch(/^Error fetching incident counts: /);
    }

    // Ensure service logged error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error in getTotalIncidents:",
      expect.any(Error)
    );
  });
});
