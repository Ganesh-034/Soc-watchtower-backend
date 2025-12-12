
// src/tests/incidentDS.service.test.js
import { jest } from "@jest/globals";

/**
 * Mirrors the ESM mocking approach from executiveSummary.service.test.js:
 * - use jest.unstable_mockModule
 * - import the service AFTER all mocks are registered
 */

// ---------- Mocks ----------
let aggregateMock;
let toArrayMock;

// Mock Incident model used by the service ("../models/incident.model.js")
// From tests, path is "../../models/incident.model.js"
await jest.unstable_mockModule("../../models/incident.model.js", () => ({
  default: {
    collection: {
      aggregate: (...args) => aggregateMock(...args),
    },
  },
}));

// Mock ApiError
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
  getIncidentsDetectionSource,
  getIncidentsDetectionSourceEscalation,
} = await import("../../services/incidentDS.service.js");

// Also import ApiError to assert instanceof
const { ApiError } = await import("../../utils/ApiError.js");

// ---------- Helpers ----------
function setAggregateReturn(items) {
  toArrayMock = jest.fn().mockResolvedValue(items);
  aggregateMock = jest.fn().mockReturnValue({
    toArray: toArrayMock,
  });
}

function getPipelineFromCall(callIndex = 0) {
  const call = aggregateMock.mock.calls[callIndex];
  expect(call).toBeDefined();
  const pipeline = call[0];
  expect(Array.isArray(pipeline)).toBe(true);
  return pipeline;
}

function findStage(pipeline, stageKey) {
  return pipeline.find((s) => stageKey in s)?.[stageKey];
}

// ---------- Suite ----------
describe("getIncidentsDetectionSource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAggregateReturn([]);
  });

  test("throws ApiError(400) when month is missing", async () => {
    await expect(getIncidentsDetectionSource(undefined, "Contoso"))
      .rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentsDetectionSource(undefined, "Contoso"))
      .rejects.toMatchObject({
        statusCode: 400,
        message: "Month parameter is required for fetching detection source data",
      });
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  test("throws ApiError(400) when customerName is missing", async () => {
    await expect(getIncidentsDetectionSource("2025-03", undefined))
      .rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentsDetectionSource("2025-03", undefined))
      .rejects.toMatchObject({
        statusCode: 400,
        message: "Customer name is required for fetching detection source data",
      });
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  test("builds pipeline with $addFields, $match, $group, $sort", async () => {
    setAggregateReturn([]);
    await getIncidentsDetectionSource("2025-03", "Contoso");

    const pipeline = getPipelineFromCall(0);

    // $addFields with month formatting from created_at
    const addFields = findStage(pipeline, "$addFields");
    expect(addFields).toBeDefined();
    expect(addFields.month).toBeDefined();
    expect(addFields.month.$dateToString).toMatchObject({
      format: "%Y-%m",
    });
    expect(addFields.month.$dateToString.date).toMatchObject({
      $toDate: "$created_at",
    });

    // $match includes month and customer_name
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({ month: "2025-03", customer_name: "Contoso" });

    // $group by incident_type and priority, with count: {$sum:1}
    const group = findStage(pipeline, "$group");
    expect(group).toBeDefined();
    expect(group._id).toEqual({ incident_type: "$incident_type", priority: "$priority" });
    expect(group.count).toEqual({ $sum: 1 });

    // $sort on incident_type asc and count desc
    const sort = findStage(pipeline, "$sort");
    expect(sort).toEqual({ "_id.incident_type": 1, count: -1 });
  });

  test("escalation wrapper adds customer_escalation = 'Yes' to $match", async () => {
    setAggregateReturn([]);
    await getIncidentsDetectionSourceEscalation("2025-03", "Fabrikam");

    const pipeline = getPipelineFromCall(0);
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({
      month: "2025-03",
      customer_name: "Fabrikam",
      customer_escalation: "Yes",
    });
  });

  test("transforms grouped results into detectionsource map with totals and Unknown -> Entra ID", async () => {
    const items = [
      // Known type: O365
      { _id: { incident_type: "O365", priority: "High" }, count: 2 },
      { _id: { incident_type: "O365", priority: "Medium" }, count: 3 },
      { _id: { incident_type: "O365", priority: "Low" }, count: 1 },
      // Unknown type should become "Entra ID"
      { _id: { incident_type: "Unknown", priority: "High" }, count: 4 },
      // Priority outside H/M/L should be ignored
      { _id: { incident_type: "O365", priority: "Critical" }, count: 7 },
      // Different type: Defender
      { _id: { incident_type: "Defender", priority: "Low" }, count: 5 },
    ];
    setAggregateReturn(items);

    const res = await getIncidentsDetectionSource("2025-03", "Contoso");

    expect(res).toHaveProperty("detectionsource");
    const ds = res.detectionsource;

    // O365 totals: High=2, Medium=3, Low=1 => Total=6 (Critical ignored)
    expect(ds.O365).toEqual({ High: 2, Medium: 3, Low: 1, Total: 6 });

    // Entra ID totals: High=4
    expect(ds["Entra ID"]).toEqual({ High: 4, Medium: 0, Low: 0, Total: 4 });

    // Defender totals: Low=5
    expect(ds.Defender).toEqual({ High: 0, Medium: 0, Low: 5, Total: 5 });
  });

  test("returns empty detectionsource when aggregation is empty", async () => {
    setAggregateReturn([]);
    const res = await getIncidentsDetectionSource("2025-03", "Contoso");
    expect(res).toEqual({ detectionsource: {} });
  });

  test("returns empty detectionsource when aggregation is undefined", async () => {
    toArrayMock = jest.fn().mockResolvedValue(undefined);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });

    const res = await getIncidentsDetectionSource("2025-03", "Contoso");
    expect(res).toEqual({ detectionsource: {} });
  });

  test("wraps unexpected errors with ApiError(500)", async () => {
    const error = new Error("Upstream error");
    toArrayMock = jest.fn().mockRejectedValue(error);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });

    await expect(getIncidentsDetectionSource("2025-03", "Contoso"))
      .rejects.toBeInstanceOf(ApiError);
    await expect(getIncidentsDetectionSource("2025-03", "Contoso"))
      .rejects.toMatchObject({
        statusCode: 500,
        message: "Error fetching incident detection source data: Upstream error",
      });
  });
});
