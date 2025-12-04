
// src/tests/incidentHS.service.test.js
import { jest } from "@jest/globals";

/**
 * ESM mocking, consistent with executiveSummary.service.test.js:
 * - use jest.unstable_mockModule
 * - import the service AFTER all mocks are registered
 */

// ---------- Mocks ----------
let aggregateMock;
let toArrayMock;

// Mock Incident model imported by the service from "../models/incident.model.js"
// From tests, the path becomes "../../models/incident.model.js"
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
  getIncidentsHandlingStatus,
  getIncidentsHandlingStatusEscalation,
} = await import("../../services/incidentHS.service.js");

// Also import ApiError to assert instanceof
const { ApiError } = await import("../../utils/ApiError.js");

// ---------- Helpers ----------
function setAggregateReturn(items) {
  toArrayMock = jest.fn().mockResolvedValue(items);
  aggregateMock = jest.fn().mockReturnValue({
    toArray: toArrayMock,
  });
}

function pipelineFromCall(idx = 0) {
  const call = aggregateMock.mock.calls[idx];
  expect(call).toBeDefined();
  const pipeline = call[0];
  expect(Array.isArray(pipeline)).toBe(true);
  return pipeline;
}

function findStage(pipeline, stageKey) {
  return pipeline.find((s) => stageKey in s)?.[stageKey];
}

function d(iso) {
  return new Date(iso);
}

// ---------- Suite ----------
describe("getIncidentsHandlingStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fix time to make month bucketing deterministic
    jest.useFakeTimers();
    jest.setSystemTime(d("2025-03-15T00:00:00Z"));
    setAggregateReturn([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("throws ApiError(400) when customerName is missing", async () => {
    await expect(getIncidentsHandlingStatus(undefined))
      .rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentsHandlingStatus(undefined))
      .rejects.toMatchObject({
        statusCode: 400,
        message: "Customer name is required for fetching incident handling status data.",
      });
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  test("builds pipeline with $match (customer_name + status $in) and $project", async () => {
    setAggregateReturn([]);
    await getIncidentsHandlingStatus("Contoso");

    const pipeline = pipelineFromCall(0);

    const match = findStage(pipeline, "$match");
    // Expect status filter and customer_name present
    expect(match).toEqual({
      customer_name: "Contoso",
      status: { $in: [2, 3, 4, 5] },
    });

    const project = findStage(pipeline, "$project");
    expect(project).toEqual({ status: 1, created_at: 1 });
  });

  test("escalation wrapper adds case-insensitive customer_escalation regex to $match", async () => {
    setAggregateReturn([]);
    await getIncidentsHandlingStatusEscalation("Fabrikam");
    const pipeline = pipelineFromCall(0);
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({
      customer_name: "Fabrikam",
      status: { $in: [2, 3, 4, 5] },
      customer_escalation: { $regex: /^yes$/i },
    });
  });

  test("dashboard mode buckets statuses across current/previous/two-months-ago (UTC)", async () => {
    // now = 2025-03-15Z -> windows: Mar-2025, Feb-2025, Jan-2025
    const items = [
      // Current month (Mar 2025)
      { created_at: d("2025-03-01T00:00:00Z"), status: 2 }, // Open
      { created_at: d("2025-03-10T00:00:00Z"), status: 4 }, // Resolved
      { created_at: d("2025-03-31T23:59:59Z"), status: 5 }, // Closed

      // Previous month (Feb 2025)
      { created_at: d("2025-02-15T12:00:00Z"), status: 3 }, // Pending

      // Two months ago (Jan 2025)
      { created_at: d("2025-01-20T00:00:00Z"), status: 2 }, // Open

      // Invalid records
      { created_at: "not-a-date", status: 2 },
      { created_at: d("2025-03-05T00:00:00Z"), status: "4" }, // non-numeric
      { created_at: d("2025-02-10T00:00:00Z"), status: 7 },   // not in map
      { status: 2 },                                         // missing date
      // Outside the 3-month window (Dec 2024) ignored
      { created_at: d("2024-12-15T00:00:00Z"), status: 5 },
    ];
    setAggregateReturn(items);

    const res = await getIncidentsHandlingStatus("ACME", false /* includeEscalatedOnly */, false /* isReport */);

    // Month IDs for dashboard windows
    expect(res.months.map((m) => m.id)).toEqual(["2025-03", "2025-02", "2025-01"]);

    // Current month counts
    expect(res.months[0].statuses).toEqual({
      Open: 1, Pending: 0, Resolved: 1, Closed: 1,
    });

    // Previous month counts
    expect(res.months[1].statuses).toEqual({
      Open: 0, Pending: 1, Resolved: 0, Closed: 0,
    });

    // Two months ago counts
    expect(res.months[2].statuses).toEqual({
      Open: 1, Pending: 0, Resolved: 0, Closed: 0,
    });
  });

  test("report mode uses previous month as 'current' report window and shifts back two months", async () => {
    // now = 2025-03-15Z -> report windows: Feb-2025 (current), Jan-2025 (prev), Dec-2024 (two months ago)
    const items = [
      { created_at: d("2025-02-10T00:00:00Z"), status: 5 }, // Closed in report current
      { created_at: d("2025-01-11T00:00:00Z"), status: 3 }, // Pending in report previous
      { created_at: d("2024-12-25T00:00:00Z"), status: 4 }, // Resolved two months ago
      // March entry should be ignored in report mode
      { created_at: d("2025-03-03T00:00:00Z"), status: 2 },
    ];
    setAggregateReturn(items);

    const res = await getIncidentsHandlingStatus("Contoso", false, true);

    expect(res.months.map((m) => m.id)).toEqual(["2025-02", "2025-01", "2024-12"]);
    expect(res.months[0].statuses).toEqual({ Open: 0, Pending: 0, Resolved: 0, Closed: 1 });
    expect(res.months[1].statuses).toEqual({ Open: 0, Pending: 1, Resolved: 0, Closed: 0 });
    expect(res.months[2].statuses).toEqual({ Open: 0, Pending: 0, Resolved: 1, Closed: 0 });
  });

  test("year boundary in report mode (January -> December of previous year)", async () => {
    // Move clock to January to test rollover
    jest.setSystemTime(d("2025-01-10T00:00:00Z"));

    // report windows: Dec-2024 (current), Nov-2024 (prev), Oct-2024 (two months ago)
    const items = [
      { created_at: d("2024-12-10T00:00:00Z"), status: 2 }, // Open
      { created_at: d("2024-11-20T00:00:00Z"), status: 4 }, // Resolved
      { created_at: d("2024-10-05T00:00:00Z"), status: 5 }, // Closed
    ];
    setAggregateReturn(items);

    const res = await getIncidentsHandlingStatus("Northwind", false, true);

    expect(res.months.map((m) => m.id)).toEqual(["2024-12", "2024-11", "2024-10"]);
    expect(res.months[0].statuses).toEqual({ Open: 1, Pending: 0, Resolved: 0, Closed: 0 });
    expect(res.months[1].statuses).toEqual({ Open: 0, Pending: 0, Resolved: 1, Closed: 0 });
    expect(res.months[2].statuses).toEqual({ Open: 0, Pending: 0, Resolved: 0, Closed: 1 });
  });

  test("returns zeroed months structure when aggregation has no items", async () => {
    setAggregateReturn([]);
    const res = await getIncidentsHandlingStatus("Contoso");

    expect(res.customerName).toBe("Contoso");
    expect(res.months).toHaveLength(3);
    res.months.forEach((m) =>
      expect(m.statuses).toEqual({ Open: 0, Pending: 0, Resolved: 0, Closed: 0 })
    );
  });

  test("wraps undefined aggregation results with ApiError(500)", async () => {
    // toArray resolves undefined -> for..of throws -> caught and wrapped
    toArrayMock = jest.fn().mockResolvedValue(undefined);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });

    await expect(getIncidentsHandlingStatus("Fabrikam"))
      .rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentsHandlingStatus("Fabrikam"))
      .rejects.toMatchObject({
        statusCode: 500,
      });
  });

  test("wraps upstream errors from aggregation with ApiError(500)", async () => {
    const upstreamErr = new Error("Upstream error");
    toArrayMock = jest.fn().mockRejectedValue(upstreamErr);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });

    await expect(getIncidentsHandlingStatus("Fabrikam"))
      .rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentsHandlingStatus("Fabrikam"))
      .rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringContaining(
          "Error fetching incident handling status data: Upstream error"
        ),
      });
  });
});