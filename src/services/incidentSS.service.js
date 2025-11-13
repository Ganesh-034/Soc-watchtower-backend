import Incident from "../models/incident.model.js";

export const getIncidentsSubStatus = async (month, customerName, includeEscalatedOnly = false) => {
  try {
    if (!month || !customerName) {
      throw new Error(
        "Both month and customerName are required for fetching sub-status data."
      );
    }

    const collection = Incident.collection;
    
    // Build the match condition dynamically
    const matchCondition = {
      month: month,
      customer_name: customerName,
    };

    // Add escalation filter if requested
    if (includeEscalatedOnly) {
      matchCondition.customer_escalation = 'Yes';
    }

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
        $match: matchCondition,
      },
      {
        $group: {
          _id: "$incident_sub_status",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    const substatusCounts = await collection.aggregate(pipeline).toArray();

    const cleanedSubstatusCounts = substatusCounts.map((item) => {
      if (!item._id) return item;

      let cleanedId = item._id;

      cleanedId = cleanedId.replace(/&nbsp;/g, " ");

      if (cleanedId.includes("(")) {
        cleanedId = cleanedId.split("(")[0].trim();
      }

      return {
        _id: cleanedId,
        count: item.count,
      };
    });

    return {
      substatus: cleanedSubstatusCounts,
    };
  } catch (error) {
    console.error("Error in getIncidentsSubStatus:", error);
    throw new Error(
      "Error fetching incident sub-status data: " + error.message
    );
  }
};

// Export a wrapper function for escalated incidents
export const getIncidentsSubStatusEscalation = async (month, customerName) => {
  return getIncidentsSubStatus(month, customerName, true);
};