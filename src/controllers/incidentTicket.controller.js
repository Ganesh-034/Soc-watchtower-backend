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
          const normalizedValues = values.map((v) => v.trim().toLowerCase());
          const statusCodes = normalizedValues
            .map((v) => statusMap[v])
            .filter((code) => code !== undefined);

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

  // FIX: Date Filtering Logic
  // The inputs are timezone-shifted (e.g., "Jan 1 00:00 Local" becomes "Dec 31 18:30 UTC").
  // To match the Chart (which counts by UTC Month), we must ignore the input times
  // and force the range to the full UTC month boundaries.
  if (startDate || endDate) {
    // 1. Parse the input to determine the Target Month (using endDate as the primary anchor)
    const dateInput = endDate || startDate; 
    const targetDate = new Date(dateInput);

    // 2. Calculate strict UTC Month Boundaries
    // getUTCFullYear() and getUTCMonth() ensure we calculate based on the UTC date of the input string
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();

    // Start of month (1st day, 00:00:00.000 UTC)
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // End of month (Last day, 23:59:59.999 UTC)
    // Date.UTC(year, month + 1, 0) gives the last day of the current month
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    // 3. Apply Filter using same DB field parsing logic as Chart Service
    const dbDateField = {
      $cond: [
        { $eq: [{ $type: "$created_at" }, "date"] },
        "$created_at",
        {
          $dateFromString: {
            dateString: "$created_at",
            onError: null,
            onNull: null,
          },
        },
      ],
    };

    mongoFilters.$expr = {
      $let: {
        vars: {
          date: dbDateField,
        },
        in: {
          $and: [
            { $ne: ["$$date", null] }, // Exclude invalid dates
            { $gte: ["$$date", start] },
            { $lte: ["$$date", end] },
          ],
        },
      },
    };
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
      return res.status(204).end();
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