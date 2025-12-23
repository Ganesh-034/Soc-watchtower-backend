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
        const { column, values } = filter;
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
          const normalizedValues = values.map(v => v.trim().toLowerCase());
          const statusCodes = normalizedValues
            .map(v => statusMap[v])
            .filter(code => code !== undefined);

          if (statusCodes.length === 1) {
            mongoFilters[dbField] = statusCodes[0];
          } else if (statusCodes.length > 1) {
            mongoFilters[dbField] = { $in: statusCodes };
          } else {
            mongoFilters[dbField] = -1;
          }
        } else {
          if (values.length === 1) {
            mongoFilters[dbField] = { $regex: values[0], $options: "i" };
          } else if (values.length > 1) {
            mongoFilters.$or = mongoFilters.$or || [];
            for (const val of values) {
              mongoFilters.$or.push({ [dbField]: { $regex: val, $options: "i" } });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error parsing filters:", error);
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid filter format"));
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

  // Check if customerName is available from middleware
  if (!req.customerName) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Customer information is required"));
  }

  mongoFilters.customer_name = req.customerName;

  try {
    const result = await incidentTicketService.getIncidentTickets(
      parseInt(page),
      parseInt(limit),
      mongoFilters
    );

    // Handle 204 No Content when no tickets are found
    if (result.tickets && result.tickets.length === 0) {
      return res.status(204).end(); // 204 responses should not include a body
    }

    // Return 200 OK with the tickets data
    return res
      .status(200)
      .json(
        new ApiResponse(200, result, "Incident tickets fetched successfully")
      );
  } catch (error) {
    // Handle different error types
    if (error.statusCode === 400) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, error.message || "Bad request"));
    } else {
      // Default to 500 Internal Server Error for unhandled errors
      return res
        .status(500)
        .json(
          new ApiResponse(500, null, error.message || "Internal server error")
        );
    }
  }
});
