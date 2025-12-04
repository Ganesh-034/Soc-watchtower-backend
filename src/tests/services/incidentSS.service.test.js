
// src/tests/incidentSS.service.test.js
import { jest } from "@jest/globals";

/**
 * ESM-friendly mocking (matches your executiveSummary tests):
 * - use jest.unstable_mockModule
 * - import the service AFTER all mocks are registered
 */

// ------------ Mocks ------------
let aggregateMock;
let toArrayMock;

// Mock Incident model used by the service ("../models/incident.model.js")
// From tests, the path becomes "../../models/incident.model.js"
await jest.unstable_mockModule("../../models/incident.model.js", () => ({
  default: {
    collection: {
      aggregate: (...args) => aggregateMock(...args),
    },
  },
}));

// Import service AFTER mocks
const {
  getIncidentsSubStatus,
  getIncidentsSubStatusForReport,
  getIncidentsSubStatusEscalation,
  getIncidentsSubStatusEscalationForReport,
} = await import("../../services/incidentSS.service.js");

// ------------ Helpers ------------
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

// ------------ Suite ------------
describe("incidentSS.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAggregateReturn([]);
  });

  // ---------------- Parameter validation ----------------
  test("getIncidentsSubStatus throws 400 when month or customerName is missing", async () => {
    await expect(getIncidentsSubStatus(undefined, "Contoso"))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(getIncidentsSubStatus("2025-03", undefined))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  test("getIncidentsSubStatusForReport throws 400 when month or customerName is missing", async () => {
    await expect(getIncidentsSubStatusForReport(undefined, "Contoso"))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(getIncidentsSubStatusForReport("2025-03", undefined))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  // ---------------- Pipeline shape: dashboard ----------------
  test("getIncidentsSubStatus builds pipeline with $addFields/$match/$group/$sort", async () => {
    setAggregateReturn([]);
    await getIncidentsSubStatus("2025-03", "Contoso");
    const pipeline = pipelineFromCall(0);

    // $addFields: month formatted from created_at
    const addFields = findStage(pipeline, "$addFields");
    expect(addFields).toBeDefined();
    expect(addFields.month.$dateToString).toMatchObject({ format: "%Y-%m" });
    expect(addFields.month.$dateToString.date).toMatchObject({ $toDate: "$created_at" });

    // $match: month + customer_name
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({ month: "2025-03", customer_name: "Contoso" });

    // $group: _id = incident_sub_status, count sum
    const group = findStage(pipeline, "$group");
    expect(group).toEqual({ _id: "$incident_sub_status", count: { $sum: 1 } });

    // $sort: count desc
    const sort = findStage(pipeline, "$sort");
    expect(sort).toEqual({ count: -1 });
  });

  // ---------------- Pipeline shape: report ----------------
  test("getIncidentsSubStatusForReport adds incident_type != 'Health Incident' to $match", async () => {
    setAggregateReturn([]);
    await getIncidentsSubStatusForReport("2025-03", "Fabrikam");
    const pipeline = pipelineFromCall(0);
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({
      month: "2025-03",
      customer_name: "Fabrikam",
      incident_type: { $ne: "Health Incident" },
    });
  });

  // ---------------- Escalation filters ----------------
  test("getIncidentsSubStatusEscalation adds customer_escalation: 'Yes' to $match", async () => {
    setAggregateReturn([]);
    await getIncidentsSubStatusEscalation("2025-03", "Contoso");
    const pipeline = pipelineFromCall(0);
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({
      month: "2025-03",
      customer_name: "Contoso",
      customer_escalation: "Yes",
    });
  });

  test("getIncidentsSubStatusEscalationForReport adds escalation filter and excludes health incidents", async () => {
    setAggregateReturn([]);
    await getIncidentsSubStatusEscalationForReport("2025-03", "Contoso");
    const pipeline = pipelineFromCall(0);
    const match = findStage(pipeline, "$match");
    expect(match).toEqual({
      month: "2025-03",
      customer_name: "Contoso",
      incident_type: { $ne: "Health Incident" },
      customer_escalation: "Yes",
    });
  });

  // ---------------- Transformation/cleanup ----------------
  test("transforms grouped results: strips parentheses and keeps counts; passes through missing _id", async () => {
    const items = [
      { _id: "True Positive (TP)", count: 3 }, // → "True Positive"
      { _id: "False Positive", count: 2 },     // unchanged
      { _id: undefined, count: 1 },            // pass-through (unchanged object)
      { _id: "Needs Review (extra)", count: 4 } // → "Needs Review"
    ];
    setAggregateReturn(items);
    const res = await getIncidentsSubStatus("2025-03", "Contoso");
    expect(res).toHaveProperty("substatus");
    expect(res.substatus).toEqual([
      { _id: "True Positive", count: 3 },
      { _id: "False Positive", count: 2 },
      { _id: undefined, count: 1 },
      { _id: "Needs Review", count: 4 },
    ]);
  });

  test("transforms results similarly in report function", async () => {
    const items = [
      { _id: "Benign (FP)", count: 5 },
      { _id: "Action Required", count: 1 },
    ];
    setAggregateReturn(items);
    const res = await getIncidentsSubStatusForReport("2025-03", "Contoso");
    expect(res).toHaveProperty("substatus");
    expect(res.substatus).toEqual([
      { _id: "Benign", count: 5 },
      { _id: "Action Required", count: 1 },
    ]);
  });

  // ---------------- Empty/undefined aggregation ----------------
  test("returns empty array when aggregation is empty", async () => {
    setAggregateReturn([]);
    const res = await getIncidentsSubStatus("2025-03", "Contoso");
    expect(res).toEqual({ substatus: [] });
  });

  test("getIncidentsSubStatus throws 500 when aggregation resolves undefined (map fails)", async () => {
    toArrayMock = jest.fn().mockResolvedValue(undefined);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    await expect(getIncidentsSubStatus("2025-03", "Contoso"))
      .rejects.toMatchObject({ statusCode: 500 });
  });

  test("getIncidentsSubStatusForReport returns undefined when aggregation resolves undefined", async () => {
    toArrayMock = jest.fn().mockResolvedValue(undefined);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    const res = await getIncidentsSubStatusForReport("2025-03", "Contoso");
    expect(res).toBeUndefined();
  });

  // ---------------- Upstream error behavior + logging ----------------
  test("getIncidentsSubStatus wraps upstream errors with statusCode=500, logs, and re-throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const upstreamErr = new Error("Upstream error");
    toArrayMock = jest.fn().mockRejectedValue(upstreamErr);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    await expect(getIncidentsSubStatus("2025-03", "Contoso"))
      .rejects.toMatchObject({ statusCode: 500 });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in getIncidentsSubStatus:",
      upstreamErr
    );
    consoleSpy.mockRestore();
  });

  test("getIncidentsSubStatusForReport swallows upstream errors (returns undefined) and logs", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const upstreamErr = new Error("Upstream error");
    toArrayMock = jest.fn().mockRejectedValue(upstreamErr);
    aggregateMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    const res = await getIncidentsSubStatusForReport("2025-03", "Contoso");
    expect(res).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in getIncidentsSubStatusForReport:",
      upstreamErr
    );
    consoleSpy.mockRestore();
  });
});
