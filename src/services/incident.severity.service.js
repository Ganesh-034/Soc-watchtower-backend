import Incident from "../models/incident.model.js";

export const getIncidentSeverity = async (customerName, includeEscalatedOnly = false, isReport = false) => {
  try {
    if (!customerName) {
      throw new Error(
        "Customer name is required for fetching incident severity data."
      );
    }

    const collection = Incident.collection;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let reportMonth, reportYear;
    
    if (isReport) {
      // For reports, use the previous month (the month the report is about)
      reportMonth = currentMonth - 1;
      reportYear = reportMonth < 0 ? currentYear - 1 : currentYear;
    } else {
      // For dashboard, use the current month
      reportMonth = currentMonth;
      reportYear = currentYear;
    }

    const currentMonthStart = new Date(reportYear, reportMonth, 1);
    const previousMonthStart = new Date(reportYear, reportMonth - 1, 1);
    const twoMonthsAgoStart = new Date(reportYear, reportMonth - 2, 1);

    const currentMonthId = `${reportYear}-${(reportMonth + 1).toString().padStart(2, "0")}`;
    const previousMonthId = `${previousMonthStart.getFullYear()}-${(previousMonthStart.getMonth() + 1).toString().padStart(2, "0")}`;
    const twoMonthsAgoId = `${twoMonthsAgoStart.getFullYear()}-${(twoMonthsAgoStart.getMonth() + 1).toString().padStart(2, "0")}`;

    const currentMonthName = currentMonthStart.toLocaleString("default", {
      month: "short",
    });
    const previousMonthName = previousMonthStart.toLocaleString("default", {
      month: "short",
    });
    const twoMonthsAgoName = twoMonthsAgoStart.toLocaleString("default", {
      month: "short",
    });

    // Build the match condition dynamically
    const matchCondition = {
      customer_name: customerName,
    };

    // Add escalation filter if requested
    if (includeEscalatedOnly) {
      matchCondition.customer_escalation = 'Yes';
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

    // Calculate the end date for the current month (last day of the month)
    const currentMonthEnd = new Date(reportYear, reportMonth + 1, 0);

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
      if (typeof item.priority === "string") {
        const priorityLower = item.priority.toLowerCase();
        if (priorityLower.includes("low")) priorityKey = "low";
        else if (
          priorityLower.includes("medium") ||
          priorityLower.includes("med")
        )
          priorityKey = "medium";
        else if (priorityLower.includes("high")) priorityKey = "high";
        else return;
      } else if (typeof item.priority === "number") {
        if (item.priority === 1) priorityKey = "low";
        else if (item.priority === 2) priorityKey = "medium";
        else if (item.priority === 3) priorityKey = "high";
        else return;
      } else {
        return;
      }

      if (createdDate >= currentMonthStart && createdDate <= currentMonthEnd) {
        result.months[0].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } else if (
        createdDate >= previousMonthStart &&
        createdDate < currentMonthStart
      ) {
        result.months[1].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } else if (
        createdDate >= twoMonthsAgoStart &&
        createdDate < previousMonthStart
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

// Export a wrapper function for escalated incidents if you want to keep the original API
export const getIncidentSeverityEscalation = async (customerName, isReport = false) => {
  return getIncidentSeverity(customerName, true, isReport);
};

