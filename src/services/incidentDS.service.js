import Incident from "../models/incident.model.js";

export const getIncidentsDetectionSource = async (month, customerName) => {
  try {
    if (!month || !customerName) {
      throw new Error(
        "Both month and customerName are required for fetching detection source data."
      );
    }

    const collection = Incident.collection;
    const pipeline = [
      {
        $addFields: {
          month: {
            $dateToString: {
              format: "%Y-%m",
              date: { $toDate: "$created_at" },
            },
          },
        },
      },
      {
        $match: {
          month: month,
          customer_name: customerName,
        },
      },
      {
        $group: {
          _id: "$incident_type",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    const detectionsourceCounts = await collection
      .aggregate(pipeline)
      .toArray();

    return {
      detectionsource: detectionsourceCounts,
    };
  } catch (error) {
    console.error("Error in getIncidentsDetectionSource:", error);
    throw new Error(
      "Error fetching incident detection source data: " + error.message
    );
  }
};
