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
          _id: {
            incident_type: "$incident_type",
            priority: "$priority"
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.incident_type": 1, count: -1 },
      },
    ];

    const detectionsourceCounts = await collection
      .aggregate(pipeline)
      .toArray();

    // Transform the data to the expected format
    const transformedData = {};
    
    detectionsourceCounts.forEach(item => {
      let incidentType = item._id.incident_type || "Unknown";
      
      // Replace "Unknown" with "Entra ID"
      if (incidentType === "Unknown") {
        incidentType = "Entra ID";
      }
      
  
      
      const priority = item._id.priority || "Unknown";
      
      if (!transformedData[incidentType]) {
        transformedData[incidentType] = {
          High: 0,
          Medium: 0,
          Low: 0,
          Total: 0 // Add total count
        };
      }
      
      // Update priority count
      if (priority === "High" || priority === "Medium" || priority === "Low") {
        transformedData[incidentType][priority] = item.count;
        transformedData[incidentType].Total += item.count;
      }
    });

    return {
      detectionsource: transformedData,
    };
  } catch (error) {
    console.error("Error in getIncidentsDetectionSource:", error);
    throw new Error(
      "Error fetching incident detection source data: " + error.message
    );
  }
};
