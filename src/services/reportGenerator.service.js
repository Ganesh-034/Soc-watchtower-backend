import puppeteer from "puppeteer";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import schedule from "node-schedule";
import * as incidentService from "./incident.severity.service.js";
import * as incidentDSService from "./incidentDS.service.js";
import * as incidentHSService from "./incidentHS.service.js";
import * as incidentSSService from "./incidentSS.service.js";
import logger from "../config/logger.js";

const __dirname = path.resolve();

// Function to generate report PDF
async function generateMonthlyReport(month = null, year = null) {
  logger.info("📅 Starting monthly report generation...");

  // If month and year are provided, use them, otherwise use current month/year
  const now = month && year ? new Date(`${month} 1, ${year}`) : new Date();
  const reportMonth = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const reportFileName = `TTS-GSOC_Monthly_Report_${month || now.toLocaleString("default", { month: "short" })}_${year || now.getFullYear()}.pdf`;

  try {
    // Fetch real incident severity data
    logger.info(
      "🔍 Fetching incident severity data for customer: centralmotorwheel-thailand"
    );
    const incidentSeverityResponse = await incidentService.getIncidentSeverity(
      "centralmotorwheel-thailand"
    );

    // Fetch real incident detection source data for current month
    const currentMonth = now.toISOString().slice(0, 7); // Format: YYYY-MM
    logger.info(
      `🔍 Fetching incident detection source data for customer: centralmotorwheel-thailand, month: ${currentMonth}`
    );
    const incidentDSResponse =
      await incidentDSService.getIncidentsDetectionSource(
        currentMonth,
        "centralmotorwheel-thailand"
      );

    // Fetch previous month data
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: centralmotorwheel-thailand, month: ${prevMonth}`
    );
    const prevMonthDSResponse =
      await incidentDSService.getIncidentsDetectionSource(
        prevMonth,
        "centralmotorwheel-thailand"
      );

    // Fetch two months ago data
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: centralmotorwheel-thailand, month: ${twoMonthsAgo}`
    );
    const twoMonthsAgoDSResponse =
      await incidentDSService.getIncidentsDetectionSource(
        twoMonthsAgo,
        "centralmotorwheel-thailand"
      );

    // Fetch incident handling status data
    logger.info(
      "🔍 Fetching incident handling status data for customer: centralmotorwheel-thailand"
    );
    const incidentHSResponse =
      await incidentHSService.getIncidentsHandlingStatus("centralmotorwheel-thailand");

    // Fetch incident sub-status data for current month
    logger.info(
      `🔍 Fetching incident sub-status data for customer: centralmotorwheel-thailand, month: ${currentMonth}`
    );
    const incidentSSResponse = await incidentSSService.getIncidentsSubStatus(
      currentMonth,
      "centralmotorwheel-thailand"
    );
    
    // Debug: Log the raw response for detection source
    logger.info(
      `📊 Raw incident detection source response: ${JSON.stringify(incidentDSResponse, null, 2)}`
    );

    // Debug: Log the raw response for handling status
    logger.info(
      `📊 Raw incident handling status response: ${JSON.stringify(incidentHSResponse, null, 2)}`
    );

    // Debug: Log the raw response for sub-status
    logger.info(
      `📊 Raw incident sub-status response: ${JSON.stringify(incidentSSResponse, null, 2)}`
    );

    // Check if the severity response is valid
    if (!incidentSeverityResponse || !incidentSeverityResponse.months) {
      logger.error("❌ Invalid incident severity response");
      throw new Error("Invalid incident severity response");
    }

    // Check if the detection source response is valid
    if (!incidentDSResponse || !incidentDSResponse.detectionsource) {
      logger.error("❌ Invalid incident detection source response");
      throw new Error("Invalid incident detection source response");
    }

    // Check if the handling status response is valid
    if (!incidentHSResponse || !incidentHSResponse.months) {
      logger.error("❌ Invalid incident handling status response");
      throw new Error("Invalid incident handling status response");
    }

    // Check if the sub-status response is valid
    if (!incidentSSResponse || !incidentSSResponse.substatus) {
      logger.error("❌ Invalid incident sub-status response");
      throw new Error("Invalid incident sub-status response");
    }

    // Format the severity data for the chart - matching the frontend structure
    const months = incidentSeverityResponse.months;

    // Debug: Log the months data
    logger.info(`📅 Months data: ${JSON.stringify(months, null, 2)}`);
    // Sort months by their period (ensure they're in correct order)
    const sortedMonths = [...months].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    // Debug: Log the sorted months
    logger.info(`📅 Sorted months: ${JSON.stringify(sortedMonths, null, 2)}`);

    // Extract month abbreviations (backend already returns 3-letter abbreviations)
    const severityChartLabels = sortedMonths.map((month) => month.name);

    // Extract series data - matching the frontend structure
    const severityChartData = {
      high: sortedMonths.map((month) => month.priorities.high || 0),
      medium: sortedMonths.map((month) => month.priorities.medium || 0),
      low: sortedMonths.map((month) => month.priorities.low || 0),
    };

    // Debug: Log the chart data
    logger.info(`📊 Chart labels: ${JSON.stringify(severityChartLabels)}`);
    logger.info(`📊 Chart data: ${JSON.stringify(severityChartData, null, 2)}`);

    // Create affiliate data for the severity table
    const incidentSeverityData = [
      {
        affiliate: "Current Month",
        high:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .low || 0,
      },
      {
        affiliate: "Previous Month",
        high:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .low || 0,
      },
      {
        affiliate: "Two Months Ago",
        high:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .low || 0,
      },
    ];

    // Debug: Log the severity table data
    logger.info(
      `📊 Table data: ${JSON.stringify(incidentSeverityData, null, 2)}`
    );

    // Process detection source data for the chart and table
    const currentMonthSources = incidentDSResponse.detectionsource || [];
    const prevMonthSources = prevMonthDSResponse?.detectionsource || [];
    const twoMonthsAgoSources = twoMonthsAgoDSResponse?.detectionsource || [];

    // Get all unique source names across all months
    const allSourceNames = new Set();
    [
      ...currentMonthSources,
      ...prevMonthSources,
      ...twoMonthsAgoSources,
    ].forEach((source) => {
      // Replace empty or null values with "EntraID"
      const sourceName = source._id || "EntraID";
      allSourceNames.add(sourceName);
    });

    const detectionChartLabels = Array.from(allSourceNames);

    // Create data for the chart (current month only)
    const detectionChartData = detectionChartLabels.map((sourceName) => {
      // Find the source in current month data
      const source = currentMonthSources.find((s) => {
        const sName = s._id || "EntraID";
        return sName === sourceName;
      });
      return source ? source.count : 0;
    });

    // Debug: Log the detection chart data
    logger.info(
      `📊 Detection Chart labels: ${JSON.stringify(detectionChartLabels)}`
    );
    logger.info(
      `📊 Detection Chart data: ${JSON.stringify(detectionChartData, null, 2)}`
    );

    // Create affiliate data for the detection source table
    const incidentDetectionData = [
      {
        affiliate: "Current Month",
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = currentMonthSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
      {
        affiliate: "Previous Month",
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = prevMonthSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
      {
        affiliate: "Two Months Ago",
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = twoMonthsAgoSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
    ];

    // Debug: Log the detection table data
    logger.info(
      `📊 Detection Table data: ${JSON.stringify(incidentDetectionData, null, 2)}`
    );

    // Process handling status data for the chart
    const hsMonths = incidentHSResponse.months;

    // Sort months by their period (ensure they're in correct order)
    const sortedHsMonths = [...hsMonths].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    // Extract month abbreviations
    const handlingStatusChartLabels = sortedHsMonths.map((month) => month.name);

    // Extract series data
    const handlingStatusChartData = {
      open: sortedHsMonths.map((month) => month.statuses.Open || 0),
      pending: sortedHsMonths.map((month) => month.statuses.Pending || 0),
      resolved: sortedHsMonths.map((month) => month.statuses.Resolved || 0),
      closed: sortedHsMonths.map((month) => month.statuses.Closed || 0),
    };

    // Debug: Log the handling status chart data
    logger.info(
      `📊 Handling Status Chart labels: ${JSON.stringify(handlingStatusChartLabels)}`
    );
    logger.info(
      `📊 Handling Status Chart data: ${JSON.stringify(handlingStatusChartData, null, 2)}`
    );

    // Create affiliate data for the handling status table
    const incidentHandlingStatusData = [
      {
        affiliate: "Current Month",
        open:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Open || 0,
        pending:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Pending || 0,
        resolved:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Resolved || 0,
        closed:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Closed || 0,
      },
      {
        affiliate: "Previous Month",
        open:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Open || 0,
        pending:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Pending || 0,
        resolved:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Resolved || 0,
        closed:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Closed || 0,
      },
      {
        affiliate: "Two Months Ago",
        open:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Open || 0,
        pending:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Pending || 0,
        resolved:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Resolved || 0,
        closed:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Closed || 0,
      },
    ];

    // Debug: Log the handling status table data
    logger.info(
      `📊 Handling Status Table data: ${JSON.stringify(incidentHandlingStatusData, null, 2)}`
    );

    // ========================================================================
    // START: UPDATED SUB-STATUS DATA PROCESSING
    // ========================================================================
    // Process sub-status data for the chart - UPDATED to match React component
    const subStatusData = incidentSSResponse.substatus || [];
    
    // Filter out null values from the substatus data
    const filteredSubstatus = subStatusData.filter(item => item._id !== null);
    
    let subStatusChartLabels, subStatusChartData, subStatusColors;
    
    if (filteredSubstatus.length === 0) {
      logger.warn("Warning: Sub-status array is empty after filtering");
      subStatusChartLabels = ["No data available"];
      subStatusChartData = [0]; // Simple array
      subStatusColors = ["#556ee6"]; // Default blue
    } else {
      // Format the data for the chart - exactly like the React component
      const formattedData = filteredSubstatus.map(item => {
        const status = item._id;
        let type = "In Progress";
        let color = "#f1b44c"; // Default yellow for In Progress

        if (status === "True Positive") {
          type = "Resolved";
          color = "#70db70"; // Green for Resolved
        } else if (status === "False Positive") {
          type = "Closed";
          color = "#66b2ff"; // Blue for Closed
        }

        return {
          status,
          count: item.count,
          type,
          color
        };
      });
      
      // Sort data to group by status type (In Progress first, then Resolved, then Closed)
      formattedData.sort((a, b) => {
        const typeOrder = { "In Progress": 0, "Resolved": 1, "Closed": 2 };
        if (a.type === b.type) return b.count - a.count;
        return typeOrder[a.type] - typeOrder[b.type];
      });
      
      // Extract categories, counts, and colors - exactly like the React component
      subStatusChartLabels = formattedData.map(item => item.status);
      subStatusChartData = formattedData.map(item => item.count); // Simple array of counts
      subStatusColors = formattedData.map(item => item.color);
      
      // Log the counts for each status type
      const resolvedCount = formattedData
        .filter(item => item.type === "Resolved")
        .reduce((sum, item) => sum + item.count, 0);
      const inProgressCount = formattedData
        .filter(item => item.type === "In Progress")
        .reduce((sum, item) => sum + item.count, 0);
      const closedCount = formattedData
        .filter(item => item.type === "Closed")
        .reduce((sum, item) => sum + item.count, 0);
        
      logger.info(`📊 Sub-status counts - Resolved: ${resolvedCount}, In Progress: ${inProgressCount}, Closed: ${closedCount}`);
    }
    // ========================================================================
    // END: UPDATED SUB-STATUS DATA PROCESSING
    // ========================================================================

    // Debug: Log the sub-status chart data
    logger.info(
      `📊 Sub-Status Chart labels: ${JSON.stringify(subStatusChartLabels)}`
    );
    logger.info(
      `📊 Sub-Status Chart data: ${JSON.stringify(subStatusChartData)}`
    );
    logger.info(
      `📊 Sub-Status Chart colors: ${JSON.stringify(subStatusColors)}`
    );

    // Create affiliate data for the sub-status table
    const incidentSubStatusData = [
      {
        affiliate: "Current Month",
        ...subStatusChartLabels.reduce((acc, statusName, index) => {
          acc[statusName] = subStatusChartData[index] || 0;
          return acc;
        }, {}),
      },
    ];

    // Debug: Log the sub-status table data
    logger.info(
      `📊 Sub-Status Table data: ${JSON.stringify(incidentSubStatusData, null, 2)}`
    );

    // Mock data for the rest of the report (you can replace these with real data later)
    const data = {
      reportMonth,
      // Real Incident by Severity Table Data
      incidentSeverityData,

      // Detection Sources (real data now)
      detectionSources: detectionChartLabels,

      // Incident by Detection Source Table Data (real data now)
      incidentDetectionData,

      // Real Incident by Severity Chart Data
      severityChartLabels,
      severityChartData,

      // Incident by Detection Source Chart Data (real data now)
      detectionChartLabels,
      detectionChartData,

      // Incident by Handling Status Data (real data now)
      handlingStatusChartLabels,
      handlingStatusChartData,
      incidentHandlingStatusData,

      // Incident by Sub Status Data (real data now)
      subStatusChartLabels,
      subStatusChartData,
      subStatusColors, // Add colors for sub-status chart
      incidentSubStatusData,

      // Incident Tickets (mock data for now)
      incidentTickets: [
        {
          id: "INC-202502001",
          date: "2025-02-01",
          affiliate: "North America",
          severity: "High",
          status: "Resolved",
          description:
            "Suspicious login activity detected from multiple locations",
        },
        {
          id: "INC-202502002",
          date: "2025-02-03",
          affiliate: "Europe",
          severity: "Medium",
          status: "In Progress",
          description: "Malware detected on endpoint device",
        },
        {
          id: "INC-202502003",
          date: "2025-02-05",
          affiliate: "Asia Pacific",
          severity: "High",
          status: "Resolved",
          description: "Data exfiltration attempt blocked by firewall",
        },
        {
          id: "INC-202502004",
          date: "2025-02-07",
          affiliate: "North America",
          severity: "Low",
          status: "Closed",
          description: "Unauthorized software installation detected",
        },
        {
          id: "INC-202502005",
          date: "2025-02-10",
          affiliate: "Europe",
          severity: "Medium",
          status: "In Progress",
          description: "Phishing campaign targeting multiple users",
        },
        {
          id: "INC-202502006",
          date: "2025-02-12",
          affiliate: "Asia Pacific",
          severity: "Low",
          status: "Resolved",
          description: "Policy violation detected on file server",
        },
        {
          id: "INC-202502007",
          date: "2025-02-15",
          affiliate: "North America",
          severity: "Medium",
          status: "Open",
          description: "Unusual network traffic pattern detected",
        },
        {
          id: "INC-202502008",
          date: "2025-02-18",
          affiliate: "Europe",
          severity: "High",
          status: "In Progress",
          description: "Ransomware attack detected on critical server",
        },
      ],

      // Health Tickets (mock data for now)
      healthTickets: [
        {
          id: "HLTH-202502001",
          date: "2025-02-02",
          affiliate: "North America",
          system: "Active Directory",
          status: "Resolved",
          description: "Replication failure between domain controllers",
        },
        {
          id: "HLTH-202502002",
          date: "2025-02-04",
          affiliate: "Europe",
          system: "Firewall",
          status: "Resolved",
          description: "High CPU utilization on security appliance",
        },
        {
          id: "HLTH-202502003",
          date: "2025-02-06",
          affiliate: "Asia Pacific",
          system: "SIEM",
          status: "In Progress",
          description: "Log ingestion delay from multiple sources",
        },
        {
          id: "HLTH-202502004",
          date: "2025-02-08",
          affiliate: "North America",
          system: "Endpoint Protection",
          status: "Closed",
          description: "Definition update failure on client systems",
        },
        {
          id: "HLTH-202502005",
          date: "2025-02-11",
          affiliate: "Europe",
          system: "IDS/IPS",
          status: "Resolved",
          description: "False positive alerts from signature 4521",
        },
        {
          id: "HLTH-202502006",
          date: "2025-02-14",
          affiliate: "Asia Pacific",
          system: "VPN",
          status: "Open",
          description: "Connection timeout issues for remote users",
        },
        {
          id: "HLTH-202502007",
          date: "2025-02-17",
          affiliate: "North America",
          system: "Email Security",
          status: "In Progress",
          description: "Spam filter not updating properly",
        },
        {
          id: "HLTH-202502008",
          date: "2025-02-20",
          affiliate: "Europe",
          system: "Network Monitoring",
          status: "Resolved",
          description: "Packet loss detected on core switch",
        },
      ],
    };

    // ✅ CORRECTED PATH: Use absolute path from project root
    const templatePath = path.join(
      process.cwd(),
      "src",
      "templates",
      "reportTemplate.ejs"
    );

    // Render HTML from EJS
    const html = await ejs.renderFile(templatePath, data);

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), "src", "reports"); // Also using absolute path for consistency
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(reportsDir, reportFileName);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "15px", right: "15px" },
    });

    await browser.close();

    logger.info(`✅ Monthly report generated: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    logger.error("❌ Error generating report:", error);
    throw error;
  }
}

// Function to get report data for HTML view
async function getReportData() {
  try {
    const now = new Date();
    const reportMonth = now.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Fetch real incident severity data
    logger.info(
      "🔍 Fetching incident severity data for customer: centralmotorwheel-thailand"
    );
    const incidentSeverityResponse = await incidentService.getIncidentSeverity(
      "centralmotorwheel-thailand"
    );

    // Fetch real incident detection source data for current month
    const currentMonth = now.toISOString().slice(0, 7); // Format: YYYY-MM
    logger.info(
      `🔍 Fetching incident detection source data for customer: centralmotorwheel-thailand, month: ${currentMonth}`
    );
    const incidentDSResponse =
      await incidentDSService.getIncidentsDetectionSource(
        currentMonth,
        "centralmotorwheel-thailand"
      );

    // Fetch previous month data
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: centralmotorwheel-thailand, month: ${prevMonth}`
    );
    const prevMonthDSResponse =
      await incidentDSService.getIncidentsDetectionSource(
        prevMonth,
        "centralmotorwheel-thailand"
      );

    // Fetch two months ago data
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: centralmotorwheel-thailand, month: ${twoMonthsAgo}`
    );
    const twoMonthsAgoDSResponse =
      await incidentDSService.getIncidentsDetectionSource(
        twoMonthsAgo,
        "centralmotorwheel-thailand"
      );

    // Fetch incident handling status data
    logger.info(
      "🔍 Fetching incident handling status data for customer: centralmotorwheel-thailand"
    );
    const incidentHSResponse =
      await incidentHSService.getIncidentsHandlingStatus("centralmotorwheel-thailand");

    // Fetch incident sub-status data for current month
    logger.info(
      `🔍 Fetching incident sub-status data for customer: centralmotorwheel-thailand, month: ${currentMonth}`
    );
    const incidentSSResponse = await incidentSSService.getIncidentsSubStatus(
      currentMonth,
      "centralmotorwheel-thailand"
    );

    // Debug: Log the raw response for detection source
    logger.info(
      `📊 Raw incident detection source response: ${JSON.stringify(incidentDSResponse, null, 2)}`
    );

    // Debug: Log the raw response for handling status
    logger.info(
      `📊 Raw incident handling status response: ${JSON.stringify(incidentHSResponse, null, 2)}`
    );

    // Debug: Log the raw response for sub-status
    logger.info(
      `📊 Raw incident sub-status response: ${JSON.stringify(incidentSSResponse, null, 2)}`
    );

    // Debug: Log the raw response
    logger.info(
      `📊 Raw incident severity response: ${JSON.stringify(incidentSeverityResponse, null, 2)}`
    );

    const months =
      incidentSeverityResponse?.data?.months ||
      incidentSeverityResponse?.months ||
      incidentSeverityResponse;
    if (!months || months.length === 0) {
      logger.error("❌ No months data found in incidentSeverityResponse");
      throw new Error("Invalid incident severity response");
    }

    // Check if the detection source response is valid
    if (!incidentDSResponse || !incidentDSResponse.detectionsource) {
      logger.error("❌ Invalid incident detection source response");
      throw new Error("Invalid incident detection source response");
    }

    // Check if the handling status response is valid
    if (!incidentHSResponse || !incidentHSResponse.months) {
      logger.error("❌ Invalid incident handling status response");
      throw new Error("Invalid incident handling status response");
    }

    // Check if the sub-status response is valid
    if (!incidentSSResponse || !incidentSSResponse.substatus) {
      logger.error("❌ Invalid incident sub-status response");
      throw new Error("Invalid incident sub-status response");
    }

    // Debug: Log the months data
    logger.info(`📅 Months data: ${JSON.stringify(months, null, 2)}`);
    // Sort months by their period (ensure they're in correct order)
    const sortedMonths = [...months].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    // Debug: Log the sorted months
    logger.info(`📅 Sorted months: ${JSON.stringify(sortedMonths, null, 2)}`);
    // Extract month abbreviations (backend already returns 3-letter abbreviations)
    const severityChartLabels = sortedMonths.map((month) => month.name);

    // Extract series data - matching the frontend structure
    const severityChartData = {
      high: sortedMonths.map((month) => month.priorities.high || 0),
      medium: sortedMonths.map((month) => month.priorities.medium || 0),
      low: sortedMonths.map((month) => month.priorities.low || 0),
    };

    // Debug: Log the chart data
    logger.info(`📊 Chart labels: ${JSON.stringify(severityChartLabels)}`);
    logger.info(`📊 Chart data: ${JSON.stringify(severityChartData, null, 2)}`);
    // Create affiliate data for the severity table
    const incidentSeverityData = [
      {
        affiliate: "Current Month",
        high:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .low || 0,
      },
      {
        affiliate: "Previous Month",
        high:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .low || 0,
      },
      {
        affiliate: "Two Months Ago",
        high:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .low || 0,
      },
    ];

    // Debug: Log the severity table data
    logger.info(
      `📊 Table data: ${JSON.stringify(incidentSeverityData, null, 2)}`
    );

    // Process detection source data for the chart and table
    const currentMonthSources = incidentDSResponse.detectionsource || [];
    const prevMonthSources = prevMonthDSResponse?.detectionsource || [];
    const twoMonthsAgoSources = twoMonthsAgoDSResponse?.detectionsource || [];

    // Get all unique source names across all months
    const allSourceNames = new Set();
    [
      ...currentMonthSources,
      ...prevMonthSources,
      ...twoMonthsAgoSources,
    ].forEach((source) => {
      // Replace empty or null values with "EntraID"
      const sourceName = source._id || "EntraID";
      allSourceNames.add(sourceName);
    });

    const detectionChartLabels = Array.from(allSourceNames);

    // Create data for the chart (current month only)
    const detectionChartData = detectionChartLabels.map((sourceName) => {
      // Find the source in current month data
      const source = currentMonthSources.find((s) => {
        const sName = s._id || "EntraID";
        return sName === sourceName;
      });
      return source ? source.count : 0;
    });

    // Debug: Log the detection chart data
    logger.info(
      `📊 Detection Chart labels: ${JSON.stringify(detectionChartLabels)}`
    );
    logger.info(
      `📊 Detection Chart data: ${JSON.stringify(detectionChartData, null, 2)}`
    );

    // Create affiliate data for the detection source table
    const incidentDetectionData = [
      {
        affiliate: "Current Month",
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = currentMonthSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
      {
        affiliate: "Previous Month",
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = prevMonthSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
      {
        affiliate: "Two Months Ago",
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = twoMonthsAgoSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
    ];

    // Debug: Log the detection table data
    logger.info(
      `📊 Detection Table data: ${JSON.stringify(incidentDetectionData, null, 2)}`
    );

    // Process handling status data for the chart
    const hsMonths = incidentHSResponse.months;

    // Sort months by their period (ensure they're in correct order)
    const sortedHsMonths = [...hsMonths].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    // Extract month abbreviations
    const handlingStatusChartLabels = sortedHsMonths.map((month) => month.name);

    // Extract series data
    const handlingStatusChartData = {
      open: sortedHsMonths.map((month) => month.statuses.Open || 0),
      pending: sortedHsMonths.map((month) => month.statuses.Pending || 0),
      resolved: sortedHsMonths.map((month) => month.statuses.Resolved || 0),
      closed: sortedHsMonths.map((month) => month.statuses.Closed || 0),
    };

    // Debug: Log the handling status chart data
    logger.info(
      `📊 Handling Status Chart labels: ${JSON.stringify(handlingStatusChartLabels)}`
    );
    logger.info(
      `📊 Handling Status Chart data: ${JSON.stringify(handlingStatusChartData, null, 2)}`
    );

    // Create affiliate data for the handling status table
    const incidentHandlingStatusData = [
      {
        affiliate: "Current Month",
        open:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Open || 0,
        pending:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Pending || 0,
        resolved:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Resolved || 0,
        closed:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Closed || 0,
      },
      {
        affiliate: "Previous Month",
        open:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Open || 0,
        pending:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Pending || 0,
        resolved:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Resolved || 0,
        closed:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Closed || 0,
      },
      {
        affiliate: "Two Months Ago",
        open:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Open || 0,
        pending:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Pending || 0,
        resolved:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Resolved || 0,
        closed:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Closed || 0,
      },
    ];

    // Debug: Log the handling status table data
    logger.info(
      `📊 Handling Status Table data: ${JSON.stringify(incidentHandlingStatusData, null, 2)}`
    );

    // ========================================================================
    // START: UPDATED SUB-STATUS DATA PROCESSING
    // ========================================================================
    // Process sub-status data for the chart - UPDATED to match React component
    const subStatusData = incidentSSResponse.substatus || [];
    
    // Filter out null values from the substatus data
    const filteredSubstatus = subStatusData.filter(item => item._id !== null);
    
    let subStatusChartLabels, subStatusChartData, subStatusColors;
    
    if (filteredSubstatus.length === 0) {
      logger.warn("Warning: Sub-status array is empty after filtering");
      subStatusChartLabels = ["No data available"];
      subStatusChartData = [0]; // Simple array
      subStatusColors = ["#556ee6"]; // Default blue
    } else {
      // Format the data for the chart - exactly like the React component
      const formattedData = filteredSubstatus.map(item => {
        const status = item._id;
        let type = "In Progress";
        let color = "#f1b44c"; // Default yellow for In Progress

        if (status === "True Positive") {
          type = "Resolved";
          color = "#70db70"; // Green for Resolved
        } else if (status === "False Positive") {
          type = "Closed";
          color = "#66b2ff"; // Blue for Closed
        }

        return {
          status,
          count: item.count,
          type,
          color
        };
      });
      
      // Sort data to group by status type (In Progress first, then Resolved, then Closed)
      formattedData.sort((a, b) => {
        const typeOrder = { "In Progress": 0, "Resolved": 1, "Closed": 2 };
        if (a.type === b.type) return b.count - a.count;
        return typeOrder[a.type] - typeOrder[b.type];
      });
      
      // Extract categories, counts, and colors - exactly like the React component
      subStatusChartLabels = formattedData.map(item => item.status);
      subStatusChartData = formattedData.map(item => item.count); // Simple array of counts
      subStatusColors = formattedData.map(item => item.color);
      
      // Log the counts for each status type
      const resolvedCount = formattedData
        .filter(item => item.type === "Resolved")
        .reduce((sum, item) => sum + item.count, 0);
      const inProgressCount = formattedData
        .filter(item => item.type === "In Progress")
        .reduce((sum, item) => sum + item.count, 0);
      const closedCount = formattedData
        .filter(item => item.type === "Closed")
        .reduce((sum, item) => sum + item.count, 0);
        
      logger.info(`📊 Sub-status counts - Resolved: ${resolvedCount}, In Progress: ${inProgressCount}, Closed: ${closedCount}`);
    }
    // ========================================================================
    // END: UPDATED SUB-STATUS DATA PROCESSING
    // ========================================================================

    // Debug: Log the sub-status chart data
    logger.info(
      `📊 Sub-Status Chart labels: ${JSON.stringify(subStatusChartLabels)}`
    );
    logger.info(
      `📊 Sub-Status Chart data: ${JSON.stringify(subStatusChartData)}`
    );
    logger.info(
      `📊 Sub-Status Chart colors: ${JSON.stringify(subStatusColors)}`
    );

    // Create affiliate data for the sub-status table
    const incidentSubStatusData = [
      {
        affiliate: "Current Month",
        ...subStatusChartLabels.reduce((acc, statusName, index) => {
          acc[statusName] = subStatusChartData[index] || 0;
          return acc;
        }, {}),
      },
    ];

    // Debug: Log the sub-status table data
    logger.info(
      `📊 Sub-Status Table data: ${JSON.stringify(incidentSubStatusData, null, 2)}`
    );

    // Return the data object
    return {
      reportMonth,
      // Real Incident by Severity Table Data
      incidentSeverityData,

      // Detection Sources (real data now)
      detectionSources: detectionChartLabels,

      // Incident by Detection Source Table Data (real data now)
      incidentDetectionData,

      // Real Incident by Severity Chart Data
      severityChartLabels,
      severityChartData,

      // Incident by Detection Source Chart Data (real data now)
      detectionChartLabels,
      detectionChartData,

      // Incident by Handling Status Data (real data now)
      handlingStatusChartLabels,
      handlingStatusChartData,
      incidentHandlingStatusData,

      // Incident by Sub Status Data (real data now)
      subStatusChartLabels,
      subStatusChartData,
      subStatusColors, // Add colors for sub-status chart
      incidentSubStatusData,

      // Incident Tickets (mock data for now)
      incidentTickets: [
        {
          id: "INC-202502001",
          date: "2025-02-01",
          affiliate: "North America",
          severity: "High",
          status: "Resolved",
          description:
            "Suspicious login activity detected from multiple locations",
        },
        {
          id: "INC-202502002",
          date: "2025-02-03",
          affiliate: "Europe",
          severity: "Medium",
          status: "In Progress",
          description: "Malware detected on endpoint device",
        },
        {
          id: "INC-202502003",
          date: "2025-02-05",
          affiliate: "Asia Pacific",
          severity: "High",
          status: "Resolved",
          description: "Data exfiltration attempt blocked by firewall",
        },
        {
          id: "INC-202502004",
          date: "2025-02-07",
          affiliate: "North America",
          severity: "Low",
          status: "Closed",
          description: "Unauthorized software installation detected",
        },
        {
          id: "INC-202502005",
          date: "2025-02-10",
          affiliate: "Europe",
          severity: "Medium",
          status: "In Progress",
          description: "Phishing campaign targeting multiple users",
        },
        {
          id: "INC-202502006",
          date: "2025-02-12",
          affiliate: "Asia Pacific",
          severity: "Low",
          status: "Resolved",
          description: "Policy violation detected on file server",
        },
        {
          id: "INC-202502007",
          date: "2025-02-15",
          affiliate: "North America",
          severity: "Medium",
          status: "Open",
          description: "Unusual network traffic pattern detected",
        },
        {
          id: "INC-202502008",
          date: "2025-02-18",
          affiliate: "Europe",
          severity: "High",
          status: "In Progress",
          description: "Ransomware attack detected on critical server",
        },
      ],

      // Health Tickets (mock data for now)
      healthTickets: [
        {
          id: "HLTH-202502001",
          date: "2025-02-02",
          affiliate: "North America",
          system: "Active Directory",
          status: "Resolved",
          description: "Replication failure between domain controllers",
        },
        {
          id: "HLTH-202502002",
          date: "2025-02-04",
          affiliate: "Europe",
          system: "Firewall",
          status: "Resolved",
          description: "High CPU utilization on security appliance",
        },
        {
          id: "HLTH-202502003",
          date: "2025-02-06",
          affiliate: "Asia Pacific",
          system: "SIEM",
          status: "In Progress",
          description: "Log ingestion delay from multiple sources",
        },
        {
          id: "HLTH-202502004",
          date: "2025-02-08",
          affiliate: "North America",
          system: "Endpoint Protection",
          status: "Closed",
          description: "Definition update failure on client systems",
        },
        {
          id: "HLTH-202502005",
          date: "2025-02-11",
          affiliate: "Europe",
          system: "IDS/IPS",
          status: "Resolved",
          description: "False positive alerts from signature 4521",
        },
        {
          id: "HLTH-202502006",
          date: "2025-02-14",
          affiliate: "Asia Pacific",
          system: "VPN",
          status: "Open",
          description: "Connection timeout issues for remote users",
        },
        {
          id: "HLTH-202502007",
          date: "2025-02-17",
          affiliate: "North America",
          system: "Email Security",
          status: "In Progress",
          description: "Spam filter not updating properly",
        },
        {
          id: "HLTH-202502008",
          date: "2025-02-20",
          affiliate: "Europe",
          system: "Network Monitoring",
          status: "Resolved",
          description: "Packet loss detected on core switch",
        },
      ],
    };
  } catch (error) {
    logger.error("❌ Error getting report data:", error);
    throw error;
  }
}

// Schedule: Run on 1st of every month at 00:00
function scheduleMonthlyReport() {
  schedule.scheduleJob("0 0 1 * *", () => {
    generateMonthlyReport();
  });
  logger.info(
    "📅 Monthly report generation scheduled for 1st of every month at 00:00"
  );
}

export { generateMonthlyReport, getReportData, scheduleMonthlyReport };