// controllers/incidentTicket.controller.js

import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentTicketService from "../services/incidentTicket.service.js";

const statusMap = {
  open: 2,
  pending: 3,
  resolved: 4,
  closed: 5,
  escalated: 6,
};

export const getIncidentTickets = catchAsync(async (req, res) => {
  const { page = 0, limit = 10, filters, startDate, endDate } = req.query;

  const mongoFilters = {};

  if (filters) {
    try {
      const parsedFilters = JSON.parse(filters);

      for (const filter of parsedFilters) {
        const { column, value } = filter;
        const fieldMap = {
          id: "_id",
          subject: "subject",
          description: "description",
          status: "status",
          priority: "priority",
          incidentType: "incident_type",
          incidentSubStatus: "incident_sub_status",
          socAnalysis: "soc_analysis",
          socRecommendation: "soc_recommendation",
          sentinelIncidentNumber: "sentinel_incident_number",
          ttps: "ttps",
          agentName: "agent_name",
        };

        const dbField = fieldMap[column];

        if (!dbField) continue;

        if (column === "status") {
          const normalizedValue = value.trim().toLowerCase();
          const statusCode = statusMap[normalizedValue];

          if (statusCode !== undefined) {
            mongoFilters[dbField] = statusCode;
          } else {
            const possibleMatches = Object.keys(statusMap).filter((status) =>
              status.toLowerCase().includes(normalizedValue)
            );

            if (possibleMatches.length > 0) {
              mongoFilters[dbField] = {
                $in: possibleMatches.map((match) => statusMap[match]),
              };
            } else {
              console.log(`No status match found for "${value}"`);
              mongoFilters[dbField] = -1;
            }
          }
        } else {
          mongoFilters[dbField] = { $regex: value, $options: "i" };
        }
      }
    } catch (error) {
      console.error("Error parsing filters:", error);
    }
  }

  if (startDate || endDate) {
    mongoFilters.created_at = mongoFilters.created_at || {};
    if (startDate) {
      mongoFilters.created_at.$gte = startDate;
    }
    if (endDate) {
      mongoFilters.created_at.$lte = endDate;
    }
  }

  mongoFilters.customer_name = req.customerName;

  const tickets = await incidentTicketService.getIncidentTickets(
    Number.parseInt(page),
    Number.parseInt(limit),
    mongoFilters
  );

  res.json(
    new ApiResponse(200, tickets, "Incident tickets fetched successfully")
  );
});
