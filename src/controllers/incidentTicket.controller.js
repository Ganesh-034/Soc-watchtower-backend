import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentTicketService from "../services/incidentTicket.service.js";

// ← Add this helper
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

          const statusCodes = normalizedValues.flatMap(v => {
            return Object.entries(statusMap)
              .filter(([key]) => key.includes(v))
              .map(([, code]) => code);
          }).filter((code, index, self) =>
            code !== undefined && self.indexOf(code) === index
          );

          if (statusCodes.length === 0) {
            mongoFilters[dbField] = -1;
          } else if (statusCodes.length === 1) {
            mongoFilters[dbField] = statusCodes[0];
          } else {
            mongoFilters[dbField] = { $in: statusCodes };
          }
        } else {
          if (values.length === 1) {
            // ← escapeRegex added
            mongoFilters[dbField] = { $regex: escapeRegex(values[0]), $options: "i" };
          } else if (values.length > 1) {
            mongoFilters.$or = mongoFilters.$or || [];
            for (const val of values) {
              // ← escapeRegex added
              mongoFilters.$or.push({ [dbField]: { $regex: escapeRegex(val), $options: "i" } });
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
      const [year, month, day] = endDate.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      mongoFilters.created_at.$lt = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }
  }

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

    if (result.tickets && result.tickets.length === 0) {
      return res.status(204).end();
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Incident tickets fetched successfully"));
  } catch (error) {
    if (error.statusCode === 400) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, error.message || "Bad request"));
    } else {
      return res
        .status(500)
        .json(new ApiResponse(500, null, error.message || "Internal server error"));
    }
  }
});