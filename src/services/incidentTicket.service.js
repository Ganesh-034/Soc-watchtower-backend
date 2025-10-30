import Incident from "../models/incident.model.js";

export const getIncidentTickets = async (
  page = 0,
  limit = 10,
  filters = {}
) => {
  try {
    if (!filters.customer_name) {
      throw new Error(
        "Customer name filter is required for fetching tickets. This is a security violation."
      );
    }

    const skip = page * limit;

    const totalCount = await Incident.countDocuments(filters);

    const sortDirection = filters.created_at ? 1 : -1;

    const tickets = await Incident.find(filters)
      .sort({ created_at: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedTickets = tickets.map((ticket) => ({
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
    }));

    return {
      tickets: formattedTickets,
      totalCount,
      page,
      limit,
    };
  } catch (error) {
    console.error("Error in getIncidentTickets:", error);
    throw new Error("Error fetching incident tickets: " + error.message);
  }
};

function mapStatus(statusCode) {
  if (statusCode === null || statusCode === undefined) {
    return "NA";
  }

  const statusMap = {
    2: "Open",
    3: "Pending",
    4: "Resolved",
    5: "Closed",
    6: "Escalated",
  };
  return statusMap[statusCode] || `Unknown (${statusCode})`;
}
