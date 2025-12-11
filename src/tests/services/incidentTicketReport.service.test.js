
// src/tests/Services/incidentTicketReport.service.test.js
import { jest } from "@jest/globals";

const mockFind = jest.fn();
const mockSort = jest.fn();
const mockLean = jest.fn();

await jest.unstable_mockModule("../../models/incident.model.js", () => ({
  default: { find: mockFind },
}));

const {
  getHealthEscalationIncidents,
  getNonHealthEscalationIncidents,
} = await import("../../services/incidentTicketReport.service.js");

function setupFindChain(returnValueArray) {
  mockFind.mockImplementation((filters) => {
    setupFindChain.lastFilters = filters;
    return {
      sort: mockSort.mockImplementation((sortSpec) => {
        setupFindChain.lastSort = sortSpec;
        return {
          lean: mockLean.mockImplementation(() => Promise.resolve(returnValueArray)),
        };
      }),
    };
  });
}

function rawTicket({
  _id = "t-1",
  subject = "Subject A",
  status = 2,
  priority = "High",
  soc_analysis = "Analysis",
  soc_recommendation = "Recommendation",
  sentinel_incident_number = "INC-100",
  ttps = "TTP-X",
  description = "Desc",
  incident_type = "Health Incident",
  incident_sub_status = "True Positive",
  created_at = "2025-09-15T12:00:00Z",
  updated_at = "2025-09-16T12:00:00Z",
  agent_name = "Agent 1",
  customer_name = "ajinomoto-thailand(ajt)",
  responder_id = "CUST-1",
  customer_sub_location = "Bangkok",
  resolved_by = "Analyst",
  customer_escalation = "Yes",
} = {}) {
  return {
    _id, subject, status, priority, soc_analysis, soc_recommendation,
    sentinel_incident_number, ttps, description, incident_type,
    incident_sub_status, created_at, updated_at, agent_name, customer_name,
    responder_id, customer_sub_location, resolved_by, customer_escalation,
  };
}

describe("incidentTicketReport.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFindChain.lastFilters = undefined;
    setupFindChain.lastSort = undefined;
  });

  describe("getHealthEscalationIncidents", () => {
    test("filters, sorts, formats and returns wrapper fields", async () => {
      setupFindChain([
        rawTicket({ _id: "h-1", status: 2, incident_type: "Health Incident" }),
        rawTicket({ _id: "h-2", status: 4, incident_type: "Health Incident" }),
      ]);

      const result = await getHealthEscalationIncidents();

      expect(setupFindChain.lastFilters).toEqual({
        incident_type: "Health Incident",
        customer_escalation: { $regex: /^yes$/i },
        created_at: { $regex: /^2025\-09/ },
        customer_name: "ajinomoto-thailand(ajt)",
      });
      expect(setupFindChain.lastSort).toEqual({ created_at: 1 });

      expect(result.count).toBe(2);
      expect(result.month).toBe("November 2025");
      expect(result.filter).toBe("Health incidents with customer escalation");

      expect(result.tickets).toHaveLength(2);
      expect(result.tickets[0].id).toBe("h-1");
      expect(result.tickets[0].status).toBe("Open");
      expect(result.tickets[1].status).toBe("Resolved");
    });

    test("formats missing fields as 'NA'", async () => {
      setupFindChain([
        rawTicket({
          _id: "h-na", subject: undefined, status: null, priority: undefined,
          soc_analysis: undefined, soc_recommendation: undefined,
          sentinel_incident_number: undefined, ttps: undefined, description: undefined,
          incident_type: undefined, incident_sub_status: undefined,
          created_at: undefined, updated_at: undefined, agent_name: undefined,
          customer_name: undefined, responder_id: undefined,
          customer_sub_location: undefined, resolved_by: undefined,
          customer_escalation: undefined,
        }),
      ]);

      const result = await getHealthEscalationIncidents();
      const t = result.tickets[0];

      expect(t.subject).toBe("NA");
      expect(t.status).toBe("NA");
      expect(t.priority).toBe("NA");
      expect(t.socAnalysis).toBe("NA");
      expect(t.socRecommendation).toBe("NA");
      expect(t.sentinelIncidentNumber).toBe("NA");
      expect(t.ttps).toBe("NA");
      expect(t.description).toBe("NA");
      expect(t.incidentType).toBe("NA");
      expect(t.incidentSubStatus).toBe("NA");
      expect(t.createdDate).toBe("NA");
      expect(t.updatedDate).toBe("NA");
      expect(t.agentName).toBe("NA");
      expect(t.customerName).toBe("NA");
      expect(t.customerId).toBe("NA");
      expect(t.customerSubLocation).toBe("NA");
      expect(t.resolvedBy).toBe("NA");
      expect(t.customerEscalation).toBe("NA");
    });

    test("wraps and throws on DB error", async () => {
      mockFind.mockImplementation(() => ({
        sort: () => ({ lean: () => Promise.reject(new Error("DB down")) }),
      }));
      await expect(getHealthEscalationIncidents()).rejects.toThrow(
        "Error fetching health escalation incidents: DB down"
      );
    });
  });

  describe("getNonHealthEscalationIncidents", () => {
    test("filters, sorts, formats and returns wrapper fields", async () => {
      setupFindChain([
        rawTicket({ _id: "nh-1", status: 3, incident_type: "Security Incident" }),
        rawTicket({ _id: "nh-2", status: 6, incident_type: "Email Incident" }),
        rawTicket({ _id: "nh-3", status: 5, incident_type: "Network Incident" }),
      ]);

      const result = await getNonHealthEscalationIncidents();

      expect(setupFindChain.lastFilters).toEqual({
        incident_type: { $ne: "Health Incident" },
        customer_escalation: { $regex: /^yes$/i },
        created_at: { $regex: /^2025\-09/ },
        customer_name: "ajinomoto-thailand(ajt)",
      });
      expect(setupFindChain.lastSort).toEqual({ created_at: 1 });

      expect(result.count).toBe(3);
      expect(result.month).toBe("November 2025");
      expect(result.filter).toBe("Non-Health incidents with customer escalation");

      const [a, b, c] = result.tickets;
      expect(a.status).toBe("Pending");
      expect(b.status).toBe("Escalated");
      expect(c.status).toBe("Closed");
    });

    test("wraps and throws on DB error", async () => {
      mockFind.mockImplementation(() => ({
        sort: () => ({ lean: () => Promise.reject(new Error("Timeout")) }),
      }));
      await expect(getNonHealthEscalationIncidents()).rejects.toThrow(
        "Error fetching non-health escalation incidents: Timeout"
      );
    });
  });
});
