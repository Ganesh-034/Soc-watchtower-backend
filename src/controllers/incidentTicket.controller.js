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

/**
 * Controller for GET /incident_ticket_table
 *
 * Fetches paginated incident tickets for the authenticated customer, with filtering and date range support.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {Object} 200 - Incident tickets fetched successfully
 * @returns {null} 204 - No tickets found
 * @returns {Object} 400 - Invalid filter format or missing customer info
 * @returns {Object} 500 - Internal Server Error
 */
export const getIncidentTickets = catchAsync(async (req, res) => {
  const { page = 0, limit = 10, filters, startDate, endDate } = req.query;

  const mongoFilters = {};

  // Parse filters if provided
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
              mongoFilters[dbField] = -1;
            }
          }
        } else {
          mongoFilters[dbField] = { $regex: value, $options: "i" };
        }
      }
    } catch (error) {
      // 400 Bad Request for invalid filter format
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid filter format"));
    }
  }

  // Add date range filter if provided
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
    // 400 Bad Request for missing customer info
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

    // 204 No Content when no tickets are found
    if (result.tickets && result.tickets.length === 0) {
      return res.status(204).end();
    }

    // 200 OK with the tickets data
    return res
      .status(200)
      .json(
        new ApiResponse(200, result, "Incident tickets fetched successfully")
      );
  } catch (error) {
    // 400 Bad Request for known errors
    if (error.statusCode === 400) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, error.message || "Bad request"));
    } else {
      // 500 Internal Server Error for unhandled errors
      return res
        .status(500)
        .json(
          new ApiResponse(500, null, error.message || "Internal server error")
        );
    }
  }
});