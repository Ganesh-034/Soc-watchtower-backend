import Incident from "../models/incident.model.js";

export const getIncidentSeverity = async (
  customerName,
  includeEscalatedOnly = false,
  isReport = false
) => {
  try {
    if (!customerName) {
      throw new Error(
        "Customer name is required for fetching incident severity data."
      );
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

    // ✅ UTC-based month ranges
    const currentMonthStart = new Date(Date.UTC(reportYear, reportMonth, 1));
    const currentMonthEnd = new Date(
      Date.UTC(reportYear, reportMonth + 1, 0, 23, 59, 59, 999)
    );

    const previousMonthStart = new Date(Date.UTC(reportYear, reportMonth - 1, 1));
    const previousMonthEnd = new Date(
      Date.UTC(reportYear, reportMonth, 0, 23, 59, 59, 999)
    );

    const twoMonthsAgoStart = new Date(Date.UTC(reportYear, reportMonth - 2, 1));
    const twoMonthsAgoEnd = new Date(
      Date.UTC(reportYear, reportMonth - 1, 0, 23, 59, 59, 999)
    );

    // Month IDs and names
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

    // ✅ Build the match condition dynamically
    const matchCondition = {
      customer_name: customerName,
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
          priority: 1,
          created_at: 1,
        },
      },
    ];

    const aggregationResults = await collection.aggregate(pipeline).toArray();

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

    // ✅ Process each incident
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

      let priorityKey;
      const priorityLower = item.priority.toString().trim().toLowerCase();
      if (priorityLower.includes("low")) priorityKey = "low";
      else if (priorityLower.includes("medium") || priorityLower.includes("med"))
        priorityKey = "medium";
      else if (priorityLower.includes("high")) priorityKey = "high";
      else if (Number(item.priority) === 1) priorityKey = "low";
      else if (Number(item.priority) === 2) priorityKey = "medium";
      else if (Number(item.priority) === 3) priorityKey = "high";
      else return;

      // ✅ Date-based categorization (UTC-safe)
      if (createdDate >= currentMonthStart && createdDate <= currentMonthEnd) {
        result.months[0].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } else if (
        createdDate >= previousMonthStart &&
        createdDate <= previousMonthEnd
      ) {
        result.months[1].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } else if (
        createdDate >= twoMonthsAgoStart &&
        createdDate <= twoMonthsAgoEnd
      ) {
        result.months[2].priorities[priorityKey]++;
        result.total[priorityKey]++;
      }
    });

    return result;
  } catch (error) {
    console.error("Error in getIncidentSeverity:", error);
    throw new Error("Error fetching incident priorities: " + error.message);
  }
};

// ✅ Wrapper for escalations
export const getIncidentSeverityEscalation = async (
  customerName,
  isReport = false
) => {
  return getIncidentSeverity(customerName, true, isReport);
};
