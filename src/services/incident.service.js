// services/incident.service.js
import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Service: getTotalIncidents
 *
 * Fetches total, open, and closed incident counts for the current month for a customer.
 *
 * @param {string} customerName - Name of the customer (required)
 *
 * @returns {Object} - { total, open, closed }
 * @throws {ApiError} 400 - Invalid or missing customerName
 * @throws {ApiError} 500 - Error fetching incident counts
 */
export const getTotalIncidents = async (customerName) => {
  try {
    // 400 Bad Request for invalid/missing input
    if (typeof customerName !== "string" || !customerName.trim()) {
      throw new ApiError(400, "customerName is required");
    }

    const name = customerName.trim();
    const collection = Incident.collection;

    // Month boundaries (UTC): current month only
    const now = new Date();
    const reportYear = now.getUTCFullYear();
    const reportMonth = now.getUTCMonth();

    const monthStart = new Date(Date.UTC(reportYear, reportMonth, 1));
    const monthEnd = new Date(Date.UTC(reportYear, reportMonth + 1, 0, 23, 59, 59, 999));

    // Aggregation pipeline
    const pipeline = [
      { $match: { customer_name: name } },
      {
        $addFields: {
          createdAt: {
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
          },
        },
      },
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", 2] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $in: ["$status", [4, 5]] }, 1, 0] } },
        },
      },
    ];

    const [agg] = await collection.aggregate(pipeline).toArray();

    // Return counts (0 if no incidents)
    return {
      total: agg?.total ?? 0,
      open: agg?.open ?? 0,
      closed: agg?.closed ?? 0,
    };
  } catch (error) {
    console.error("Error in getTotalIncidents:", error);

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Error fetching incident counts: " + error.message);
  }
};