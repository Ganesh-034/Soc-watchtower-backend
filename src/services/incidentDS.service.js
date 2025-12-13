import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Service: getIncidentsDetectionSource
 *
 * Fetches incident counts by detection source for a given month and customer.
 *
 * @param {string} month - Month in YYYY-MM format (required)
 * @param {string} customerName - Name of the customer (required)
 * @param {boolean} includeEscalatedOnly - If true, only include escalated incidents
 *
 * @returns {Object} - Incident counts by detection source
 * @throws {ApiError} 400 - Missing required parameters
 * @throws {ApiError} 500 - Error fetching incident detection source data
 */
export const getIncidentsDetectionSource = async (
  month,
  customerName,
  includeEscalatedOnly = false
) => {
  // Parameter validation
  if (!month) {
    throw new ApiError(
      400,
      "Month parameter is required for fetching detection source data"
    );
  }

  if (!customerName) {
    throw new ApiError(
      400,
      "Customer name is required for fetching detection source data"
    );
  }

  try {
    const collection = Incident.collection;

    const matchCondition = {
      month: month,
      customer_name: customerName,
    };

    // Add escalation filter if requested
    if (includeEscalatedOnly) {
      matchCondition.customer_escalation = "Yes";
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
          _id: {
            incident_type: "$incident_type",
            priority: "$priority",
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

    detectionsourceCounts.forEach((item) => {
      let incidentType = item._id.incident_type || "Unknown";
      if (incidentType === "Unknown") {
        incidentType = "Others";
      }

      const priority = item._id.priority || "Unknown";

      if (!transformedData[incidentType]) {
        transformedData[incidentType] = {
          High: 0,
          Medium: 0,
          Low: 0,
          Total: 0,
        };
      }

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

    // 500 for other errors
    throw new ApiError(
      500,
      `Error fetching incident detection source data: ${error.message}`
    );
  }
};

// Wrapper for escalated incidents
export const getIncidentsDetectionSourceEscalation = async (
  month,
  customerName
) => {
  return getIncidentsDetectionSource(month, customerName, true);
};