// // services/incident.service.js
// import Incident from "../models/incident.model.js";
// import { ApiError } from "../utils/ApiError.js";

// export const getTotalIncidents = async (customerName) => {
//   try {
//     // 400 Bad Request for invalid/missing input
//     if (typeof customerName !== "string" || !customerName.trim()) {
//       throw new ApiError(400, "customerName is required");
//     }

//     const name = customerName.trim();
//     const collection = Incident.collection;

//     const totalCount = await collection.countDocuments({
//       customer_name: name,
//     });

//     const pipeline = [
//       { $match: { customer_name: name } },
//       {
//         $group: {
//           _id: "$status",
//           count: { $sum: 1 },
//         },
//       },
//     ];

//     const statusCounts = await collection.aggregate(pipeline).toArray();

//     let openCount = 0;
//     let closedCount = 0;

//     statusCounts.forEach((item) => {
//       if (item._id === 2) openCount = item.count;
//       if (item._id === 4 || item._id === 5) closedCount += item.count;
//     });

//     return {
//       total: totalCount,
//       open: openCount,
//       closed: closedCount,
//     };
//   } catch (error) {
//     console.error("Error in getTotalIncidents:", error);

//     if (error instanceof ApiError) {
//       throw error;
//     }
//     throw new ApiError(500, "Error fetching incident counts: " + error.message);
//   }
// };




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

    // ----- Month boundaries (UTC): current month only -----
    const now = new Date();
    const reportYear = now.getUTCFullYear();
    const reportMonth = now.getUTCMonth();

    const monthStart = new Date(Date.UTC(reportYear, reportMonth, 1));
    const monthEnd = new Date(Date.UTC(reportYear, reportMonth + 1, 0, 23, 59, 59, 999));

    // ----- Single aggregation: normalize created_at + filter by month + compute totals -----
    const pipeline = [
      { $match: { customer_name: name } },

      // Normalize created_at into a proper Date (handles string vs Date)
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

      // Keep only incidents in the current month
      {
        $match: {
          createdAt: { $gte: monthStart, $lte: monthEnd },
        },
      },

      // Compute totals in one pass
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: {
            $sum: {
              $cond: [{ $eq: ["$status", 2] }, 1, 0],
            },
          },
          closed: {
            $sum: {
              $cond: [{ $in: ["$status", [4, 5]] }, 1, 0],
            },
          },
        },
      },
    ];

    const [agg] = await collection.aggregate(pipeline).toArray();

    // In case there are no incidents this month
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
