import Incident from "../models/incident.model.js";

export const getIncidentsHandlingStatus = async (customerName, includeEscalatedOnly = false) => {
  try {
    if (!customerName) {
      throw new Error(
        "Customer name is required for fetching incident handling status data."
      );
    }

    const collection = Incident.collection;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const twoMonthsAgoStart = new Date(currentYear, currentMonth - 2, 1);

    const currentMonthId = `${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}`;
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

    // Build the match condition dynamically
    const matchCondition = {
      customer_name: customerName,
      status: { $in: [2, 3, 4, 5] },
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
          status: 1,
          created_at: 1,
        },
      },
    ];

    const aggregationResults = await collection.aggregate(pipeline).toArray();

    aggregationResults.forEach((item) => {
      if (!item.created_at || typeof item.status !== "number") return;

      const createdDate = new Date(item.created_at);
      if (isNaN(createdDate.getTime())) return;

      const statusLabel = statusMap[item.status];
      if (!statusLabel) return;

      if (createdDate >= currentMonthStart && createdDate <= now) {
        result.months[0].statuses[statusLabel]++;
      } else if (
        createdDate >= previousMonthStart &&
        createdDate < currentMonthStart
      ) {
        result.months[1].statuses[statusLabel]++;
      } else if (
        createdDate >= twoMonthsAgoStart &&
        createdDate < previousMonthStart
      ) {
        result.months[2].statuses[statusLabel]++;
      }
    });

    return result;
  } catch (error) {
    console.error("Error in getIncidentsHandlingStatus:", error);
    throw new Error(
      "Error fetching incident handling status data: " + error.message
    );
  }
};

// Export a wrapper function for escalated incidents
export const getIncidentsHandlingStatusEscalation = async (customerName) => {
  return getIncidentsHandlingStatus(customerName, true);
};