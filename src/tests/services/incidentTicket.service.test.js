
// src/tests/incidentTicket.service.test.js
import { jest } from "@jest/globals";

/**
 * ESM-friendly mocking style:
 * - use jest.unstable_mockModule
 * - import the service AFTER mocks are registered
 */

// ---------- Mocks ----------
let countDocumentsMock;
let findMock;
let sortMock;
let skipMock;
let limitMock;
let leanMock;

function setIncidentMocks({ tickets = [], totalCount = 0, leanReject = null } = {}) {
  // Chain object to simulate Mongoose's query builder
  const chain = {};
  sortMock = jest.fn().mockReturnValue(chain);
  skipMock = jest.fn().mockReturnValue(chain);
  limitMock = jest.fn().mockReturnValue(chain);
  leanMock = leanReject
    ? jest.fn().mockRejectedValue(leanReject)
    : jest.fn().mockResolvedValue(tickets);

  Object.assign(chain, {
    sort: sortMock,
    skip: skipMock,
    limit: limitMock,
    lean: leanMock,
  });

  countDocumentsMock = jest.fn().mockResolvedValue(totalCount);
  findMock = jest.fn().mockReturnValue(chain);
}

// Mock Incident model used by the service ("../models/incident.model.js")
// From tests, the relative path becomes "../../models/incident.model.js"
await jest.unstable_mockModule("../../models/incident.model.js", () => ({
  default: {
    countDocuments: (...args) => countDocumentsMock(...args),
    find: (...args) => findMock(...args),
  },
}));

// Import the service AFTER registering mocks
const { getIncidentTickets } = await import("../../services/incidentTicket.service.js");

// ---------- Helpers ----------
function buildTicket(overrides = {}) {
  return {
    _id: "abc123",
    subject: "Phishing attempt",
    status: 2, // -> "Open"
    priority: "High",
    soc_analysis: "Analysis text",
    soc_recommendation: "Recommendation text",
    sentinel_incident_number: "INC-789",
    ttps: "TTP info",
    description: "Desc",
    incident_type: "O365",
    incident_sub_status: "True Positive",
    created_at: new Date("2025-03-12T00:00:00Z"),
    updated_at: new Date("2025-03-13T00:00:00Z"),
    agent_name: "Analyst One",
    customer_name: "Contoso",
    responder_id: "RID-1",
    customer_sub_location: "BLR",
    resolved_by: "Analyst Two",
    customer_escalation: "No",
    ...overrides,
  };
}

// ---------- Suite ----------
describe("getIncidentTickets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("throws when filters.customer_name is missing (security violation message)", async () => {
    setIncidentMocks();
    const filters = {}; // no customer_name

    await expect(getIncidentTickets(0, 10, filters)).rejects.toThrow(
      "Customer name filter is required for fetching tickets. This is a security violation."
    );
    expect(countDocumentsMock).not.toHaveBeenCalled();
    expect(findMock).not.toHaveBeenCalled();
  });

  test("returns formatted tickets with descending sort when filters.created_at is absent", async () => {
    const page = 2;
    const limit = 5;
    const filters = { customer_name: "Contoso" }; // no created_at -> sort -1

    const tickets = [
      buildTicket(), // full record
      buildTicket({
        // partial record forces "NA" fallbacks + status NA
        _id: null,
        subject: "",
        status: null, // -> "NA"
        priority: undefined,
        soc_analysis: undefined,
        soc_recommendation: undefined,
        sentinel_incident_number: undefined,
        ttps: undefined,
        description: undefined,
        incident_type: undefined,
        incident_sub_status: undefined,
        created_at: undefined,
        updated_at: undefined,
        agent_name: undefined,
        customer_name: undefined,
        responder_id: undefined,
        customer_sub_location: undefined,
        resolved_by: undefined,
        customer_escalation: undefined,
      }),
    ];

    setIncidentMocks({ tickets, totalCount: 42 });

    const res = await getIncidentTickets(page, limit, filters);

    // countDocuments/find filters
    expect(countDocumentsMock).toHaveBeenCalledWith(filters);
    expect(findMock).toHaveBeenCalledWith(filters);

    // sort direction: -1 when filters.created_at is falsy
    expect(sortMock).toHaveBeenCalledWith({ created_at: -1 });

    // pagination
    expect(skipMock).toHaveBeenCalledWith(page * limit); // 10
    expect(limitMock).toHaveBeenCalledWith(limit);       // 5

    // lean executed
    expect(leanMock).toHaveBeenCalled();

    // response envelope
    expect(res.totalCount).toBe(42);
    expect(res.page).toBe(page);
    expect(res.limit).toBe(limit);
    expect(Array.isArray(res.tickets)).toBe(true);
    expect(res.tickets).toHaveLength(2);

    // First ticket fully mapped
    const t1 = res.tickets[0];
    expect(t1).toEqual({
      id: "abc123",
      subject: "Phishing attempt",
      status: "Open", // 2 -> "Open"
      priority: "High",
      socAnalysis: "Analysis text",
      socRecommendation: "Recommendation text",
      sentinelIncidentNumber: "INC-789",
      ttps: "TTP info",
      description: "Desc",
      incidentType: "O365",
      incidentSubStatus: "True Positive",
      createdDate: new Date("2025-03-12T00:00:00Z"),
      updatedDate: new Date("2025-03-13T00:00:00Z"),
      agentName: "Analyst One",
      customerName: "Contoso",
      customerId: "RID-1",
      customerSubLocation: "BLR",
      resolvedBy: "Analyst Two",
      customerEscalation: "No",
    });

    // Second ticket should have "NA" fallbacks and status "NA"
    const t2 = res.tickets[1];
    expect(t2).toEqual({
      id: "NA",
      subject: "NA",
      status: "NA",
      priority: "NA",
      socAnalysis: "NA",
      socRecommendation: "NA",
      sentinelIncidentNumber: "NA",
      ttps: "NA",
      description: "NA",
      incidentType: "NA",
      incidentSubStatus: "NA",
      createdDate: "NA",
      updatedDate: "NA",
      agentName: "NA",
      customerName: "NA",
      customerId: "NA",
      customerSubLocation: "NA",
      resolvedBy: "NA",
      customerEscalation: "NA",
    });
  });

  test("uses ascending sort (created_at: 1) when filters.created_at is present", async () => {
    const filters = {
      customer_name: "Contoso",
      created_at: { $gte: new Date("2025-03-01T00:00:00Z") }, // any truthy created_at triggers ascending
    };
    setIncidentMocks({ tickets: [buildTicket()] });

    const res = await getIncidentTickets(0, 10, filters);

    expect(sortMock).toHaveBeenCalledWith({ created_at: 1 });
    expect(res.tickets[0].status).toBe("Open");
  });

  test("maps status codes to labels and unknown codes to 'Unknown (<code>)'", async () => {
    const tickets = [
      buildTicket({ status: 3 }), // Pending
      buildTicket({ status: 4 }), // Resolved
      buildTicket({ status: 5 }), // Closed
      buildTicket({ status: 6 }), // Escalated
      buildTicket({ status: 9 }), // Unknown(9)
      buildTicket({ status: undefined }), // NA
    ];
    setIncidentMocks({ tickets });

    const res = await getIncidentTickets(0, 10, { customer_name: "Contoso" });
    const statuses = res.tickets.map((t) => t.status);
    expect(statuses).toEqual([
      "Pending",
      "Resolved",
      "Closed",
      "Escalated",
      "Unknown (9)",
      "NA",
    ]);
  });

  test("wraps upstream errors with 'Error fetching incident tickets: <message>'", async () => {
    // Make lean reject with an upstream error
    const upstreamErr = new Error("Upstream failure");
    setIncidentMocks({ leanReject: upstreamErr });

    await expect(
      getIncidentTickets(0, 10, { customer_name: "Contoso" })
    ).rejects.toThrow("Error fetching incident tickets: Upstream failure");
  });
});