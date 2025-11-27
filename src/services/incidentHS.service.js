import Incident from "../models/incident.model.js";
import { ApiError } from "../utils/ApiError.js";

export const getIncidentsHandlingStatus = async (
  customerName,
  includeEscalatedOnly = false,
  isReport = false
) => {
  try {
    if (!customerName) {
      throw new ApiError(400, "Customer name is required for fetching incident handling status data.");
    }

    const collection = Incident.collection;

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    let reportMonth, reportYear;

    if (isReport) {
      // For reports, use the previous month (the month the report is about)
      reportMonth = currentMonth - 1;
      reportYear = reportMonth < 0 ? currentYear - 1 : currentYear;
      if (reportMonth < 0) reportMonth = 11; // December of previous year
    } else {
      // For dashboard, use the current month
      reportMonth = currentMonth;
      reportYear = currentYear;
    }

    // ✅ Define UTC date boundaries
    const currentMonthStart = new Date(Date.UTC(reportYear, reportMonth, 1));
    const currentMonthEnd = new Date(
      Date.UTC(reportYear, reportMonth + 1, 0, 23, 59, 59, 999)
    );

    const previousMonthStart = new Date(
      Date.UTC(reportYear, reportMonth - 1, 1)
    );
    const previousMonthEnd = new Date(
      Date.UTC(reportYear, reportMonth, 0, 23, 59, 59, 999)
    );

    const twoMonthsAgoStart = new Date(
      Date.UTC(reportYear, reportMonth - 2, 1)
    );
    const twoMonthsAgoEnd = new Date(
      Date.UTC(reportYear, reportMonth - 1, 0, 23, 59, 59, 999)
    );

    // ✅ Month identifiers and display names
    const currentMonthId = `${reportYear}-${(reportMonth + 1)
      .toString()
      .padStart(2, "0")}`;
    const previousMonthId = `${previousMonthStart.getUTCFullYear()}-${(
      previousMonthStart.getUTCMonth() + 1
    )
      .toString()
      .padStart(2, "0")}`;
    const twoMonthsAgoId = `${twoMonthsAgoStart.getUTCFullYear()}-${(
      twoMonthsAgoStart.getUTCMonth() + 1
    )
      .toString()
      .padStart(2, "0")}`;

    const currentMonthName = currentMonthStart.toLocaleString("default", {
      month: "short",
    });
    const previousMonthName = previousMonthStart.toLocaleString("default", {
      month: "short",
    });
    const twoMonthsAgoName = twoMonthsAgoStart.toLocaleString("default", {
      month: "short",
    });

    const result = {
      customerName,
      months: [
        {
          id: currentMonthId,
          name: currentMonthName,
          period: "Current Month",
          statuses: { Open: 0, Pending: 0, Resolved: 0, Closed: 0 },
        },
        {
          id: previousMonthId,
          name: previousMonthName,
          period: "Previous Month",
          statuses: { Open: 0, Pending: 0, Resolved: 0, Closed: 0 },
        },
        {
          id: twoMonthsAgoId,
          name: twoMonthsAgoName,
          period: "Two Months Ago",
          statuses: { Open: 0, Pending: 0, Resolved: 0, Closed: 0 },
        },
      ],
    };

    const statusMap = {
      2: "Open",
      3: "Pending",
      4: "Resolved",
      5: "Closed",
    };

    // ✅ Build the match condition dynamically
    const matchCondition = {
      customer_name: customerName,
      status: { $in: [2, 3, 4, 5] },
    };

    // ✅ Add escalation filter (case-insensitive)
    if (includeEscalatedOnly) {
      matchCondition.customer_escalation = { $regex: /^yes$/i };
    }

    const pipeline = [
      {
        $match: matchCondition,
      },
      {
        $project: {
          status: 1,
          created_at: 1,
        },
      },
    ];

    const aggregationResults = await collection.aggregate(pipeline).toArray();

    // ✅ Categorize results by month and status
    for (const item of aggregationResults) {
      if (!item.created_at || typeof item.status !== "number") continue;

      const createdDate = new Date(item.created_at);
      if (Number.isNaN(createdDate.getTime())) continue;

      const statusLabel = statusMap[item.status];
      if (!statusLabel) continue;

      if (createdDate >= currentMonthStart && createdDate <= currentMonthEnd) {
        result.months[0].statuses[statusLabel]++;
      } else if (
        createdDate >= previousMonthStart &&
        createdDate <= previousMonthEnd
      ) {
        result.months[1].statuses[statusLabel]++;
      } else if (
        createdDate >= twoMonthsAgoStart &&
        createdDate <= twoMonthsAgoEnd
      ) {
        result.months[2].statuses[statusLabel]++;
      }
    }

    return result;
  } catch (error) {
    console.error("Error in getIncidentsHandlingStatus:", error);
    
    // Proper error handling with status codes
    if (error instanceof ApiError) {
      throw error; 
    } else {
      throw new ApiError(500, "Error fetching incident handling status data: " + error.message);
    }
  }
};

// ✅ Wrapper for escalated incidents
export const getIncidentsHandlingStatusEscalation = async (
  customerName,
  isReport = false
) => {
  return getIncidentsHandlingStatus(customerName, true, isReport);
};
