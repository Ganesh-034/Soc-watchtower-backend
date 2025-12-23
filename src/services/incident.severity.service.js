import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Service: getIncidentSeverity
 *
 * Fetches incident counts by severity for the last three months for a customer.
 *
 * @param {string} customerName - Name of the customer (required)
 * @param {boolean} includeEscalatedOnly - If true, only include escalated incidents
 * @param {boolean} isReport - If true, use previous month as the "current" month
 *
 * @returns {Object} - Incident severity data
 * @throws {ApiError} 400 - Invalid or missing customerName
 * @throws {ApiError} 500 - Error fetching incident priorities
 */
export const getIncidentSeverity = async (
  customerName,
  includeEscalatedOnly = false,
  isReport = false
) => {
  try {
    if (!customerName || typeof customerName !== "string" || !customerName.trim()) {
      throw new ApiError(400, "Customer name is required for fetching incident severity data");
    }

    const collection = Incident.collection;

    // Date calculations for three months (UTC)
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    let reportMonth, reportYear;
    if (isReport) {
      // For reports, use the previous month
      reportMonth = currentMonth - 1;
      reportYear = reportMonth < 0 ? currentYear - 1 : currentYear;
      if (reportMonth < 0) reportMonth = 11; // December of previous year
    } else {
      reportMonth = currentMonth;
      reportYear = currentYear;
    }

    // Month boundaries
    const currentMonthStart = new Date(Date.UTC(reportYear, reportMonth, 1));
    const currentMonthEnd = new Date(Date.UTC(reportYear, reportMonth + 1, 0, 23, 59, 59, 999));
    const previousMonthStart = new Date(Date.UTC(reportYear, reportMonth - 1, 1));
    const previousMonthEnd = new Date(Date.UTC(reportYear, reportMonth, 0, 23, 59, 59, 999));
    const twoMonthsAgoStart = new Date(Date.UTC(reportYear, reportMonth - 2, 1));
    const twoMonthsAgoEnd = new Date(Date.UTC(reportYear, reportMonth - 1, 0, 23, 59, 59, 999));

    // Month IDs and names
    const currentMonthId = `${reportYear}-${(reportMonth + 1).toString().padStart(2, "0")}`;
    const previousMonthId = `${previousMonthStart.getUTCFullYear()}-${(previousMonthStart.getUTCMonth() + 1).toString().padStart(2, "0")}`;
    const twoMonthsAgoId = `${twoMonthsAgoStart.getUTCFullYear()}-${(twoMonthsAgoStart.getUTCMonth() + 1).toString().padStart(2, "0")}`;

    const currentMonthName = currentMonthStart.toLocaleString("default", { month: "short" });
    const previousMonthName = previousMonthStart.toLocaleString("default", { month: "short" });
    const twoMonthsAgoName = twoMonthsAgoStart.toLocaleString("default", { month: "short" });

    // Build the match condition dynamically
    const matchCondition = { customer_name: customerName };
    if (includeEscalatedOnly) {
      matchCondition.customer_escalation = { $regex: /^yes$/i };
    }

    const pipeline = [
      { $match: matchCondition },
      { $project: { priority: 1, created_at: 1 } },
    ];

    // Execute the aggregation
    const aggregationResults = await collection.aggregate(pipeline).toArray();

    // Prepare result structure
    const result = {
      customerName: customerName,
      months: [
        {
          id: currentMonthId,
          name: currentMonthName,
          period: "Current Month",
          priorities: { low: 0, medium: 0, high: 0 },
        },
        {
          id: previousMonthId,
          name: previousMonthName,
          period: "Previous Month",
          priorities: { low: 0, medium: 0, high: 0 },
        },
        {
          id: twoMonthsAgoId,
          name: twoMonthsAgoName,
          period: "Two Months Ago",
          priorities: { low: 0, medium: 0, high: 0 },
        },
      ],
      total: { low: 0, medium: 0, high: 0 },
    };

    // If no data found, return all zeros
    if (!aggregationResults || aggregationResults.length === 0) {
      return result;
    }

    // Helper to classify priority
    function getPriorityKey(priority) {
      if (!priority) return null;
      const p = priority.toString().trim().toLowerCase();
      if (p.includes("low")) return "low";
      if (p.includes("medium") || p.includes("med")) return "medium";
      if (p.includes("high")) return "high";
      if (Number(priority) === 1) return "low";
      if (Number(priority) === 2) return "medium";
      if (Number(priority) === 3) return "high";
      return null;
    }

    // Process each incident
    aggregationResults.forEach((item) => {
      if (!item.created_at || !item.priority) return;

      let createdDate;
      if (typeof item.created_at === "string") {
        createdDate = new Date(item.created_at);
        if (isNaN(createdDate.getTime())) return;
      } else if (item.created_at instanceof Date) {
        createdDate = item.created_at;
      } else {
        return;
      }

      const priorityKey = getPriorityKey(item.priority);
      if (!priorityKey) return;

      // Date-based categorization (UTC-safe)
      if (createdDate >= currentMonthStart && createdDate <= currentMonthEnd) {
        result.months[0].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } else if (createdDate >= previousMonthStart && createdDate <= previousMonthEnd) {
        result.months[1].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } else if (createdDate >= twoMonthsAgoStart && createdDate <= twoMonthsAgoEnd) {
        result.months[2].priorities[priorityKey]++;
        result.total[priorityKey]++;
      }
    });

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Error in getIncidentSeverity:", error);
    throw new ApiError(500, `Error fetching incident priorities: ${error.message}`);
  }
};

/**
 * Wrapper for escalations only
 */
export const getIncidentSeverityEscalation = async (
  customerName,
  isReport = false
) => {
  return getIncidentSeverity(customerName, true, isReport);
};