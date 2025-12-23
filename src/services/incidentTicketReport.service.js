import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

// Helper function to format ticket data
const formatTicket = (ticket) => ({
  id: ticket._id || "NA",
  subject: ticket.subject || "NA",
  status: mapStatus(ticket.status),
  priority: ticket.priority || "NA",
  socAnalysis: ticket.soc_analysis || "NA",
  socRecommendation: ticket.soc_recommendation || "NA",
  sentinelIncidentNumber: ticket.sentinel_incident_number || "NA",
  ttps: ticket.ttps || "NA",
  description: ticket.description || "NA",
  incidentType: ticket.incident_type || "NA",
  incidentSubStatus: ticket.incident_sub_status || "NA",
  createdDate: ticket.created_at || "NA",
  updatedDate: ticket.updated_at || "NA",
  agentName: ticket.agent_name || "NA",
  customerName: ticket.customer_name || "NA",
  customerId: ticket.responder_id || "NA",
  customerSubLocation: ticket.customer_sub_location || "NA",
  resolvedBy: ticket.resolved_by || "NA",
  customerEscalation: ticket.customer_escalation || "NA",
});

// Helper function to map status codes to readable strings
function mapStatus(statusCode) {
  if (statusCode == null) return "NA";
  const statusMap = {
    2: "Open",
    3: "Pending",
    4: "Resolved",
    5: "Closed",
    6: "Escalated",
  };
  return statusMap[statusCode] || `Unknown (${statusCode})`;
}

// Regex for November 2025 (matches strings like "2025-11-05T06:04:53Z")
const november2025Regex = /^2025-11/;

/**
 * Service: getHealthEscalationIncidents
 * 
 * Fetches all 'Health Incident' tickets with customer escalation for November 2025.
 * 
 * @returns {Object} - Tickets and meta info
 * @throws {ApiError} 500 - Error fetching health escalation incidents
 */
export const getHealthEscalationIncidents = async () => {
  try {
    const filters = {
      incident_type: "Health Incident",
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: november2025Regex },
      customer_name: "ajinomoto-thailand(ajt)",
    };

    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();
    const formattedTickets = tickets.map(formatTicket);

    return {
      tickets: formattedTickets,
      count: formattedTickets.length,
      month: "November 2025",
      filter: "Health incidents with customer escalation",
    };
  } catch (error) {
    console.error("Error in getHealthEscalationIncidents:", error);
    throw new ApiError(
      500,
      "Error fetching health escalation incidents: " + error.message
    );
  }
};

/**
 * Service: getNonHealthEscalationIncidents
 * 
 * Fetches all non-'Health Incident' tickets with customer escalation for November 2025.
 * 
 * @returns {Object} - Tickets and meta info
 * @throws {ApiError} 500 - Error fetching non-health escalation incidents
 */
export const getNonHealthEscalationIncidents = async () => {
  try {
    const filters = {
      incident_type: { $ne: "Health Incident" },
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: november2025Regex },
      customer_name: "ajinomoto-thailand(ajt)",
    };

    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();
    const formattedTickets = tickets.map(formatTicket);

    return {
      tickets: formattedTickets,
      count: formattedTickets.length,
      month: "November 2025",
      filter: "Non-Health incidents with customer escalation",
    };
  } catch (error) {
    console.error("Error in getNonHealthEscalationIncidents:", error);
    throw new ApiError(
      500,
      "Error fetching non-health escalation incidents: " + error.message
    );
  }
};