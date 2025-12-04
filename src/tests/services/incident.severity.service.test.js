
// src/tests/incident.severity.service.test.js
import { jest } from "@jest/globals";

/**
 * We mirror the ESM mocking style from executiveSummary.service.test.js:
 * - use jest.unstable_mockModule
 * - import the service AFTER all mocks are registered
 * - fix the system clock for deterministic month ranges
 */

// ---------- Mocks ----------
let aggregateMock;
let toArrayMock;

// Mock Incident model (as imported by the service from "../models/incident.model.js")
// From this test file, the relative path becomes "../../models/incident.model.js"
await jest.unstable_mockModule("../../models/incident.model.js", () => ({
  default: {
    collection: {
      aggregate: (...args) => aggregateMock(...args),
    },
  },
}));

// Mock ApiError (named export)
class ApiErrorMock extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}
await jest.unstable_mockModule("../../utils/ApiError.js", () => ({
  ApiError: ApiErrorMock,
}));

// Import service AFTER mocks
const {
  getIncidentSeverity,
  getIncidentSeverityEscalation,
} = await import("../../services/incident.severity.service.js");

// Also import ApiError so we can assert instanceof
const { ApiError } = await import("../../utils/ApiError.js");

// ---------- Helpers ----------
function setAggregateReturn(items) {
  toArrayMock = jest.fn().mockResolvedValue(items);
  aggregateMock = jest.fn().mockReturnValue({
    toArray: toArrayMock,
  });
}

function pipelineMatch() {
  const call = aggregateMock.mock.calls[0];
  expect(call).toBeDefined();
  const pipeline = call[0];
  const matchStage = pipeline.find((s) => "$match" in s)?.$match;
  return matchStage;
}

// Build a date utility for specific UTC dates
function d(iso) {
  return new Date(iso);
}

// ---------- Suite ----------
describe("incident severity service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fix the system time for deterministic calculations:
    // Default: 2025-03-15T00:00:00Z (report/dash reference month handling)
    jest.useFakeTimers();
    jest.setSystemTime(d("2025-03-15T00:00:00Z"));

    // Default aggregate result: empty array
    setAggregateReturn([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("throws ApiError(400) when customerName is missing", async () => {
    await expect(getIncidentSeverity(undefined)).rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentSeverity(undefined)).rejects.toMatchObject({
      statusCode: 400,
      message: "Customer name is required for fetching incident severity data",
    });
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  test("returns zeroed structure when aggregation returns empty array", async () => {
    setAggregateReturn([]);
    const res = await getIncidentSeverity("Contoso");
    expect(res.customerName).toBe("Contoso");

    // Structure
    expect(res.months).toHaveLength(3);
    expect(res.months.map((m) => m.period)).toEqual([
      "Current Month",
      "Previous Month",
      "Two Months Ago",
    ]);

    // IDs: now = 2025-03 -> current=2025-03, prev=2025-02, twoAgo=2025-01
    const ids = res.months.map((m) => m.id);
    expect(ids).toEqual(["2025-03", "2025-02", "2025-01"]);

    // Totals zero
    expect(res.total).toEqual({ low: 0, medium: 0, high: 0 });
    res.months.forEach((m) =>
      expect(m.priorities).toEqual({ low: 0, medium: 0, high: 0 })
    );

    // Match condition without escalation when includeEscalatedOnly=false
    const match = pipelineMatch();
    expect(match).toEqual({ customer_name: "Contoso" });
  });

  test("includes escalation filter in $match when using getIncidentSeverityEscalation", async () => {
    setAggregateReturn([]);
    await getIncidentSeverityEscalation("Contoso");
    const match = pipelineMatch();
    expect(match).toEqual({
      customer_name: "Contoso",
      customer_escalation: { $regex: /^yes$/i },
    });
  });

  test("maps priorities (string & numeric) and buckets by month in dashboard mode", async () => {
    // now = 2025-03-15Z
    const items = [
      // Current month (Mar 2025)
      { created_at: d("2025-03-10T00:00:00Z"), priority: "High" },
      { created_at: d("2025-03-01T00:00:00Z"), priority: "low" },

      // Previous month (Feb 2025)
      { created_at: d("2025-02-05T00:00:00Z"), priority: "Med" },

      // Two months ago (Jan 2025) - numeric
      { created_at: d("2025-01-20T00:00:00Z"), priority: 1 },

      // Invalid/missing fields should be ignored
      { created_at: "not-a-date", priority: "High" },
      { created_at: d("2025-03-05T00:00:00Z") }, // no priority
      // Outside the 3-month window (Dec 2024) ignored in dashboard mode
      { created_at: d("2024-12-15T00:00:00Z"), priority: "High" },
    ];
    setAggregateReturn(items);

    const res = await getIncidentSeverity("Fabrikam", false /* dashboard */, false);
    expect(res.months.map((m) => m.id)).toEqual(["2025-03", "2025-02", "2025-01"]);

    // Current (Mar): high=1, low=1
    expect(res.months[0].priorities).toEqual({ low: 1, medium: 0, high: 1 });

    // Previous (Feb): med=1
    expect(res.months[1].priorities).toEqual({ low: 0, medium: 1, high: 0 });

    // Two months ago (Jan): low=1 (numeric 1 -> low)
    expect(res.months[2].priorities).toEqual({ low: 1, medium: 0, high: 0 });

    // Totals: low=2, med=1, high=1
    expect(res.total).toEqual({ low: 2, medium: 1, high: 1 });
  });

  test("report mode (isReport=true) uses previous month as the 'current month' window", async () => {
    // now = 2025-03-15Z -> reportMonth = Feb 2025; windows: Feb, Jan, Dec(2024)
    const items = [
      // February (current report month)
      { created_at: d("2025-02-10T00:00:00Z"), priority: "High" },
      // January (previous)
      { created_at: d("2025-01-11T00:00:00Z"), priority: "Medium" },
      // December (two months ago from report month)
      { created_at: d("2024-12-25T00:00:00Z"), priority: 3 }, // numeric -> high
      // March (outside all report-mode windows)
      { created_at: d("2025-03-03T00:00:00Z"), priority: "Low" },
    ];
    setAggregateReturn(items);

    const res = await getIncidentSeverity("ACME", false /* includeEscalatedOnly */, true /* isReport */);

    // IDs for report windows: Feb-2025, Jan-2025, Dec-2024
    expect(res.months.map((m) => m.id)).toEqual(["2025-02", "2025-01", "2024-12"]);

    // Feb: high=1
    expect(res.months[0].priorities).toEqual({ low: 0, medium: 0, high: 1 });

    // Jan: medium=1
    expect(res.months[1].priorities).toEqual({ low: 0, medium: 1, high: 0 });

    // Dec: high=1
    expect(res.months[2].priorities).toEqual({ low: 0, medium: 0, high: 1 });

    // March item ignored in report mode
    expect(res.total).toEqual({ low: 0, medium: 1, high: 2 });
  });

  test("year boundary handling in report mode (January -> Dec of previous year)", async () => {
    // Move system time to January to test negative month rollover
    jest.setSystemTime(d("2025-01-10T00:00:00Z"));
    const items = [
      { created_at: d("2024-12-10T00:00:00Z"), priority: "High" }, // current (Dec 2024)
      { created_at: d("2024-11-10T00:00:00Z"), priority: "Med" },  // previous
      { created_at: d("2024-10-10T00:00:00Z"), priority: 1 },      // two months ago
    ];
    setAggregateReturn(items);

    const res = await getIncidentSeverity("Northwind", false, true);

    // Report windows when now=Jan-2025: Dec-2024, Nov-2024, Oct-2024
    expect(res.months.map((m) => m.id)).toEqual(["2024-12", "2024-11", "2024-10"]);
    expect(res.months[0].priorities).toEqual({ low: 0, medium: 0, high: 1 });
    expect(res.months[1].priorities).toEqual({ low: 0, medium: 1, high: 0 });
    expect(res.months[2].priorities).toEqual({ low: 1, medium: 0, high: 0 });
    expect(res.total).toEqual({ low: 1, medium: 1, high: 1 });
  });

  test("handles undefined aggregation results by returning zeroed structure", async () => {
    toArrayMock = jest.fn().mockResolvedValue(undefined);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });

    const res = await getIncidentSeverity("Contoso");
    expect(res.total).toEqual({ low: 0, medium: 0, high: 0 });
    expect(res.months).toHaveLength(3);
  });
});
