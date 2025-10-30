import Incident from "../models/incident.model.js";

export const getTotalIncidents = async (customerName) => {
  try {
    if (!customerName) {
      throw new Error("Customer name is required");
    }

    const collection = Incident.collection;

    const totalCount = await collection.countDocuments({
      customer_name: customerName,
    });

    const pipeline = [
      {
        $match: { customer_name: customerName },
      },
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
      if (item._id === 5) closedCount = item.count;
    });

    return {
      total: totalCount,
      open: openCount,
      closed: closedCount,
    };
  } catch (error) {
    console.error("Error in getTotalIncidents:", error);
    throw new Error("Error fetching incident counts: " + error.message);
  }
};
