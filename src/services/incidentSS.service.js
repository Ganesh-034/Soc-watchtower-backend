import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Service: getIncidentsSubStatus
 *
 * Fetches incident counts by sub-status for a given month and customer.
 *
 * @param {string} month - Month in YYYY-MM format (required)
 * @param {string} customerName - Name of the customer (required)
 * @param {boolean} includeEscalatedOnly - If true, only include escalated incidents
 *
 * @returns {Object} - Incident counts by sub-status
 * @throws {ApiError} 400 - Missing required parameters
 * @throws {ApiError} 500 - Error fetching incident sub-status data
 */
export const getIncidentsSubStatus = async (
  month,
  customerName,
  includeEscalatedOnly = false
) => {
  try {
    if (!month || !customerName) {
      throw new ApiError(
        400,
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

      let cleanedId = item._id.replaceAll("&nbsp;", " ");
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
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      "Error fetching incident sub-status data: " + error.message
    );
  }
};

/**
 * Service: getIncidentsSubStatusForReport
 *
 * Fetches incident counts by sub-status for a given month and customer, excluding health incidents.
 *
 * @param {string} month - Month in YYYY-MM format (required)
 * @param {string} customerName - Name of the customer (required)
 * @param {boolean} includeEscalatedOnly - If true, only include escalated incidents
 *
 * @returns {Object} - Incident counts by sub-status (excluding health incidents)
 * @throws {ApiError} 400 - Missing required parameters
 * @throws {ApiError} 500 - Error fetching incident sub-status data
 */
export const getIncidentsSubStatusForReport = async (
  month,
  customerName,
  includeEscalatedOnly = false
) => {
  try {
    if (!month || !customerName) {
      throw new ApiError(
        400,
        "Both month and customerName are required for fetching sub-status data."
      );
    }

    const collection = Incident.collection;

    // Build the match condition dynamically
    const matchCondition = {
      month: month,
      customer_name: customerName,
      incident_type: { $ne: "Health Incident" },
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

      let cleanedId = item._id.replaceAll("&nbsp;", " ");
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
    console.error("Error in getIncidentsSubStatusForReport:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      "Error fetching incident sub-status data (report): " + error.message
    );
  }
};

// Wrapper for escalated incidents (for dashboard)
export const getIncidentsSubStatusEscalation = async (month, customerName) => {
  return getIncidentsSubStatus(month, customerName, true);
};

// Wrapper for escalated incidents (for reports)
export const getIncidentsSubStatusEscalationForReport = async (
  month,
  customerName
) => {
  return getIncidentsSubStatusForReport(month, customerName, true);
};