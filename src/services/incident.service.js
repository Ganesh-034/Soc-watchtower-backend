// services/incident.service.js
import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

export const getTotalIncidents = async (customerName) => {
  try {
    // 400 Bad Request for invalid/missing input
    if (typeof customerName !== "string" || !customerName.trim()) {
      throw new ApiError(400, "customerName is required");
    }

    const name = customerName.trim();
    const collection = Incident.collection;

    const totalCount = await collection.countDocuments({
      customer_name: name,
    });

    const pipeline = [
      { $match: { customer_name: name } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ];

    const statusCounts = await collection.aggregate(pipeline).toArray();

    let openCount = 0;
    let closedCount = 0;

    statusCounts.forEach((item) => {
      if (item._id === 2) openCount = item.count;
      if (item._id === 4 || item._id === 5) closedCount += item.count;
    });

    return {
      total: totalCount,
      open: openCount,
      closed: closedCount,
    };
  } catch (error) {
    console.error("Error in getTotalIncidents:", error);

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Error fetching incident counts: " + error.message);
  }
};
