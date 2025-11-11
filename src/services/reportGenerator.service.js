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
import Incident from "../models/incident.model.js"; // Import the Incident model

// Customer configuration
const customers = {
  "toyotatsushoapacsoc": "Toyota Tsusho Asia Pacific",
  "centralmotorwheel-thailand": "Centralmotorwheel Thailand",
  "taiho-thailand": "Taiho Thailand"
};

// Helper function to format ticket data (moved from controller for reuse)
const formatTicket = (ticket) => ({
  id: ticket._id || "NA",
  subject: ticket.subject || "NA",
  status: mapStatus(ticket.status),
  priority: ticket.priority || "NA",
  socAnalysis: ticket.soc_analysis || "NA",
  socRecommendation: ticket.soc_recommendation || "NA",
  sentinelIncidentNumber: ticket.sentinel_incident_number || "NA",
  ttps: ticket.ttps || "NA",
  description: ticket.description || "NA",
  incidentType: ticket.incident_type || "NA",
  incidentSubStatus: ticket.incident_sub_status || "NA",
  createdDate: ticket.created_at || "NA",
  updatedDate: ticket.updated_at || "NA",
  agentName: ticket.agent_name || "NA",
  customerName: ticket.customer_name || "NA",
  customerId: ticket.responder_id || "NA",
  customerSubLocation: ticket.customer_sub_location || "NA",
  resolvedBy: ticket.resolved_by || "NA",
  customerEscalation: ticket.customer_escalation || "NA",
});

// Helper function to map status codes to readable strings
function mapStatus(statusCode) {
  if (statusCode == null) return "NA";

  const statusMap = {
    2: "Open",
    3: "Pending",
    4: "Resolved",
    5: "Closed",
    6: "Escalated",
  };
  return statusMap[statusCode] || `Unknown (${statusCode})`;
}

// ✅ UPDATED: Function to get Health Escalation Incidents
const getHealthEscalationIncidents = async (customerName, month, year) => {
  try {
    // Create regex for the specified month and year
    const dateRegex = new RegExp(`^${year}-${String(month).padStart(2, '0')}`);

    const filters = {
      customer_name: customerName, // ✅ UPDATED: Use parameter instead of hardcoded value
      incident_type: "Health Incident",
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: dateRegex }, // ✅ UPDATED: Use dynamic date filter
    };

    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();

    const formattedTickets = tickets.map(formatTicket);

    logger.info(
      `🎫 Fetched ${formattedTickets.length} health escalation tickets for ${customerName} (${month}/${year}).`
    );
    return formattedTickets;
  } catch (error) {
    logger.error("Error in getHealthEscalationIncidents:", error);
    throw new Error(
      "Error fetching health escalation incidents: " + error.message
    );
  }
};

// ✅ UPDATED: Function to get Non-Health Escalation Incidents
const getNonHealthEscalationIncidents = async (customerName, month, year) => {
  try {
    // Create regex for the specified month and year
    const dateRegex = new RegExp(`^${year}-${String(month).padStart(2, '0')}`);

    const filters = {
      customer_name: customerName, // ✅ UPDATED: Use parameter instead of hardcoded value
      incident_type: { $ne: "Health Incident" },
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: dateRegex }, // ✅ UPDATED: Use dynamic date filter
    };

    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();

    const formattedTickets = tickets.map(formatTicket);

    logger.info(
      `🎫 Fetched ${formattedTickets.length} non-health escalation tickets for ${customerName} (${month}/${year}).`
    );
    return formattedTickets;
  } catch (error) {
    logger.error("Error in getNonHealthEscalationIncidents:", error);
    throw new Error(
      "Error fetching non-health escalation incidents: " + error.message
    );
  }
};

const __dirname = path.resolve();

// Function to generate report PDF for a specific customer and month
async function generateMonthlyReportForCustomer(
  customerKey,
  customerDisplayName,
  month = null,
  year = null
) {
  logger.info(`📅 Starting monthly report generation for ${customerDisplayName} (${month}/${year})...`);

  // If month and year are provided, use them, otherwise use current month/year
  const reportDate = month && year ? new Date(`${month} 1, ${year}`) : new Date();
  const reportMonth = reportDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const reportFileName = `${customerKey}_Monthly_Report_${reportDate.toLocaleString("default", { month: "short" })}_${reportDate.getFullYear()}.pdf`;

  try {
    // Format month for API calls
    const formattedMonth = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;

    // ... (All the existing data fetching for charts remains the same but with customerKey)
    // Fetch real incident severity data
    logger.info(
      `🔍 Fetching incident severity data for customer: ${customerKey}`
    );
    const incidentSeverityResponse =
      await incidentService.getIncidentSeverityEscalation(
        customerKey, true
      );

    // Fetch real incident detection source data for specified month
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${formattedMonth}`
    );
    const incidentDSResponse =
      await incidentDSService.getIncidentsDetectionSourceEscalation(
        formattedMonth,
        customerKey
      );

    // Fetch previous month data
    const prevMonth = new Date(reportDate.getFullYear(), reportDate.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${prevMonth}`
    );

    // Fetch two months ago data
    const twoMonthsAgo = new Date(reportDate.getFullYear(), reportDate.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${twoMonthsAgo}`
    );

    // Fetch incident handling status data
    logger.info(
      `🔍 Fetching incident handling status data for customer: ${customerKey}`
    );
    const incidentHSResponse =
      await incidentHSService.getIncidentsHandlingStatusEscalation(
        customerKey, true
      );

    // Fetch incident sub-status data for specified month
    logger.info(
      `🔍 Fetching incident sub-status data for customer: ${customerKey}, month: ${formattedMonth}`
    );
    const incidentSSResponse = await incidentSSService.getIncidentsSubStatusEscalation(
      formattedMonth,
      customerKey
    );

    // ... (All the existing data processing for charts remains the same)
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
        affiliate: customerDisplayName, // ✅ UPDATED: Use customer display name
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
    ];

    // Debug: Log the severity table data
    logger.info(
      `📊 Table data: ${JSON.stringify(incidentSeverityData, null, 2)}`
    );

    // In generateMonthlyReport and getReportData functions, replace the existing detection source processing code with this:

    // Process detection source data for the chart and table
    const currentMonthSources = incidentDSResponse.detectionsource || {};

    // Filter out health incidents for report but keep the original data for frontend
    const filteredSources = {};
    Object.keys(currentMonthSources).forEach((sourceName) => {
      // Skip "Health Incident" for report
      if (sourceName !== "Health Incident") {
        filteredSources[sourceName] = currentMonthSources[sourceName];
      }
    });

    // Get only incident types from filtered data (for report)
    const detectionChartLabels = Object.keys(filteredSources);

    // Create data for the chart (current month only) - we'll use grouped bar chart
    const detectionChartData = {
      high: detectionChartLabels.map(
        (sourceName) => filteredSources[sourceName]?.High || 0
      ),
      medium: detectionChartLabels.map(
        (sourceName) => filteredSources[sourceName]?.Medium || 0
      ),
      low: detectionChartLabels.map(
        (sourceName) => filteredSources[sourceName]?.Low || 0
      ),
    };

    // Debug: Log the detection chart data
    logger.info(
      `📊 Detection Chart labels: ${JSON.stringify(detectionChartLabels)}`
    );
    logger.info(
      `📊 Detection Chart data: ${JSON.stringify(detectionChartData, null, 2)}`
    );

    // Create affiliate data for the detection source table (current month only)
    const incidentDetectionData = [
      {
        affiliate: customerDisplayName, // ✅ UPDATED: Use customer display name
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = filteredSources[sourceName] || {};
          acc[sourceName] = source.Total || 0; // Use the total count
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

    // Process sub-status data for the chart - UPDATED to match requirements
    const subStatusData = incidentSSResponse.substatus || [];

    // Filter out null values from the substatus data
    const filteredSubstatus = subStatusData.filter((item) => item._id !== null);

    let subStatusChartLabels, subStatusChartData, subStatusColors;

    if (filteredSubstatus.length === 0) {
      logger.warn("Warning: Sub-status array is empty after filtering");
      subStatusChartLabels = ["No data available"];
      subStatusChartData = [0]; // Simple array
      subStatusColors = ["#556ee6"]; // Default blue
    } else {
      // Define the color mapping according to requirements
      const colorMap = {
        "SOC Investigating": "#0066ff", // blue
        "Tuning": "#ffcc00", // yellow
        "Awaiting Customer Response": "#ff8c00", // orange
        "False Positive": "#00cc00", // green
        "True Positive": "#ff0000", // red
      };
      
      // Format the data for the chart
      const formattedData = filteredSubstatus.map((item) => {
        const status = item._id;
        // Use the color from our mapping, or a default color if not found
        const color = colorMap[status] || "#556ee6"; // Default blue
        
        return {
          status,
          count: item.count,
          color,
        };
      });

      // Sort data to match the desired order
      const desiredOrder = [
        "SOC Investigating",
        "Tuning", 
        "Awaiting Customer Response",
        "False Positive",
        "True Positive"
      ];
      
      formattedData.sort((a, b) => {
        const aIndex = desiredOrder.indexOf(a.status);
        const bIndex = desiredOrder.indexOf(b.status);
        
        // If both statuses are in our desired order, sort by that order
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        
        // If only one is in our desired order, prioritize it
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // If neither is in our desired order, sort alphabetically
        return a.status.localeCompare(b.status);
      });

      // Extract categories, counts, and colors
      subStatusChartLabels = formattedData.map((item) => item.status);
      subStatusChartData = formattedData.map((item) => item.count); // Simple array of counts
      subStatusColors = formattedData.map((item) => item.color);

      // Log the counts for each status type
      const countsByStatus = {};
      formattedData.forEach(item => {
        countsByStatus[item.status] = item.count;
      });
      
      logger.info(
        `📊 Sub-status counts: ${JSON.stringify(countsByStatus)}`
      );
    }

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

    // ========================================================================
    // START: FETCH REAL TICKET DATA
    // ========================================================================
    logger.info(
      "🎫 Fetching real data for incident and health ticket tables..."
    );

    // Fetch non-health escalation incidents for the "Analysis on Incident Ticket" table
    const incidentTicketsData = await getNonHealthEscalationIncidents(
      customerKey, 
      reportDate.getMonth() + 1, 
      reportDate.getFullYear()
    );

    // Fetch health escalation incidents for the "Analysis on Health Ticket" table
    const healthTicketsData = await getHealthEscalationIncidents(
      customerKey, 
      reportDate.getMonth() + 1, 
      reportDate.getFullYear()
    );

    logger.info(
      `✅ Fetched ${incidentTicketsData.length} incident tickets and ${healthTicketsData.length} health tickets.`
    );
    // ========================================================================
    // END: FETCH REAL TICKET DATA
    // ========================================================================

    // Define the legend data for substatus chart
    const subStatusLegend = [
      { label: "SOC Investigating", color: "#0066ff" },
      { label: "Tuning", color: "#ffcc00" },
      { label: "Awaiting Customer Response", color: "#ff8c00" },
      { label: "False Positive", color: "#00cc00" },
      { label: "True Positive", color: "#ff0000" }
    ];

    // Mock data for the rest of the report (you can replace these with real data later)
    const data = {
      reportMonth,
      // ✅ UPDATED: Use customer display name in title
      customerDisplayName,
      
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
      subStatusLegend, // Add legend data for sub-status chart
      incidentSubStatusData,

      // ✅ UPDATED: Real Incident Tickets Data
      incidentTickets: incidentTicketsData,

      // ✅ UPDATED: Real Health Tickets Data
      healthTickets: healthTicketsData,
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

    // Create customer/year/month directory if it doesn't exist
    const reportsDir = path.join(
      process.cwd(), 
      "src", 
      "reports", 
      customerKey, 
      reportDate.getFullYear().toString(),
      reportDate.toLocaleString("default", { month: "short" }).toLowerCase()
    );
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

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

    logger.info(`✅ Monthly report generated for ${customerDisplayName} (${reportDate.getMonth() + 1}/${reportDate.getFullYear()}): ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    logger.error(`❌ Error generating report for ${customerDisplayName} (${reportDate.getMonth() + 1}/${reportDate.getFullYear()}):`, error);
    throw error;
  }
}

// ✅ NEW: Function to generate reports for all months from January 2025 for all customers
async function generateAllHistoricalReports() {
  logger.info("📅 Starting historical report generation for all customers...");
  const reportPaths = [];
  
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11
    
    // Generate report for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(customers)) {
      try {
        // Generate reports from January 2025 to current month
        for (let year = 2025; year <= currentYear; year++) {
          const startMonth = year === 2025 ? 1 : 1; // Start from January for all years
          const endMonth = year === currentYear ? currentMonth : 12; // End at current month for current year
          
          for (let month = startMonth; month <= endMonth; month++) {
            try {
              const reportPath = await generateMonthlyReportForCustomer(
                customerKey,
                customerDisplayName,
                month,
                year
              );
              reportPaths.push(reportPath);
              logger.info(`✅ Generated report for ${customerDisplayName} (${month}/${year})`);
            } catch (error) {
              logger.error(`❌ Failed to generate report for ${customerDisplayName} (${month}/${year}):`, error);
              // Continue with other months even if one fails
            }
          }
        }
      } catch (error) {
        logger.error(`❌ Failed to generate reports for ${customerDisplayName}:`, error);
        // Continue with other customers even if one fails
      }
    }
    
    logger.info(`✅ Generated ${reportPaths.length} historical reports for all customers`);
    return reportPaths;
  } catch (error) {
    logger.error("❌ Error generating historical reports for all customers:", error);
    throw error;
  }
}

// Function to generate report PDF for all customers for the previous month
async function generateMonthlyReport() {
  logger.info("📅 Starting monthly report generation for all customers (previous month)...");
  const reportPaths = [];
  
  try {
    // Get the previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = prevMonth.getMonth() + 1; // getMonth() returns 0-11
    const year = prevMonth.getFullYear();
    
    // Generate report for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(customers)) {
      try {
        const reportPath = await generateMonthlyReportForCustomer(
          customerKey,
          customerDisplayName,
          month,
          year
        );
        reportPaths.push(reportPath);
      } catch (error) {
        logger.error(`❌ Failed to generate report for ${customerDisplayName}:`, error);
        // Continue with other customers even if one fails
      }
    }
    
    logger.info(`✅ Generated ${reportPaths.length} reports for all customers for ${month}/${year}`);
    return reportPaths;
  } catch (error) {
    logger.error("❌ Error generating reports for all customers:", error);
    throw error;
  }
}

// Function to get report data for a specific customer
async function getReportDataForCustomer(customerKey, customerDisplayName) {
  try {
    const now = new Date();
    const reportMonth = now.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // ... (All the existing data fetching for charts remains the same but with customerKey)
    // Fetch real incident severity data
    logger.info(
      `🔍 Fetching incident severity data for customer: ${customerKey}`
    );
    const incidentSeverityResponse =
      await incidentService.getIncidentSeverityEscalation(
        customerKey, true
      );

    // Fetch real incident detection source data for current month
    const currentMonth = now.toISOString().slice(0, 7); // Format: YYYY-MM
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${currentMonth}`
    );
    const incidentDSResponse =
      await incidentDSService.getIncidentsDetectionSourceEscalation(
        currentMonth,
        customerKey
      );

    // Fetch previous month data
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${prevMonth}`
    );
    const prevMonthDSResponse =
      await incidentDSService.getIncidentsDetectionSourceEscalation(
        prevMonth,
        customerKey
      );

    // Fetch two months ago data
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${twoMonthsAgo}`
    );
    const twoMonthsAgoDSResponse =
      await incidentDSService.getIncidentsDetectionSourceEscalation(
        twoMonthsAgo,
        customerKey
      );

    // Fetch incident handling status data
    logger.info(
      `🔍 Fetching incident handling status data for customer: ${customerKey}`
    );
    const incidentHSResponse =
      await incidentHSService.getIncidentsHandlingStatusEscalation(
        customerKey, true
      );

    // Fetch incident sub-status data for current month
    logger.info(
      `🔍 Fetching incident sub-status data for customer: ${customerKey}, month: ${currentMonth}`
    );
    const incidentSSResponse = await incidentSSService.getIncidentsSubStatusEscalation(
      currentMonth,
      customerKey
    );

    // ... (All the existing data processing for charts remains the same)
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
        affiliate: customerDisplayName, // ✅ UPDATED: Use customer display name
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
        affiliate: customerDisplayName, // ✅ UPDATED: Use customer display name
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

    // Process sub-status data for the chart - UPDATED to match requirements
    const subStatusData = incidentSSResponse.substatus || [];

    // Filter out null values from the substatus data
    const filteredSubstatus = subStatusData.filter((item) => item._id !== null);

    let subStatusChartLabels, subStatusChartData, subStatusColors;

    if (filteredSubstatus.length === 0) {
      logger.warn("Warning: Sub-status array is empty after filtering");
      subStatusChartLabels = ["No data available"];
      subStatusChartData = [0]; // Simple array
      subStatusColors = ["#556ee6"]; // Default blue
    } else {
      // Define the color mapping according to requirements
      const colorMap = {
        "SOC Investigating": "#0066ff", // blue
        "Tuning": "#ffcc00", // yellow
        "Awaiting Customer Response": "#ff8c00", // orange
        "False Positive": "#00cc00", // green
        "True Positive": "#ff0000", // red
      };
      
      // Format the data for the chart
      const formattedData = filteredSubstatus.map((item) => {
        const status = item._id;
        // Use the color from our mapping, or a default color if not found
        const color = colorMap[status] || "#556ee6"; // Default blue
        
        return {
          status,
          count: item.count,
          color,
        };
      });

      // Sort data to match the desired order
      const desiredOrder = [
        "SOC Investigating",
        "Tuning", 
        "Awaiting Customer Response",
        "False Positive",
        "True Positive"
      ];
      
      formattedData.sort((a, b) => {
        const aIndex = desiredOrder.indexOf(a.status);
        const bIndex = desiredOrder.indexOf(b.status);
        
        // If both statuses are in our desired order, sort by that order
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        
        // If only one is in our desired order, prioritize it
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // If neither is in our desired order, sort alphabetically
        return a.status.localeCompare(b.status);
      });

      // Extract categories, counts, and colors
      subStatusChartLabels = formattedData.map((item) => item.status);
      subStatusChartData = formattedData.map((item) => item.count); // Simple array of counts
      subStatusColors = formattedData.map((item) => item.color);

      // Log the counts for each status type
      const countsByStatus = {};
      formattedData.forEach(item => {
        countsByStatus[item.status] = item.count;
      });
      
      logger.info(
        `📊 Sub-status counts: ${JSON.stringify(countsByStatus)}`
      );
    }

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

    // ========================================================================
    // START: FETCH REAL TICKET DATA
    // ========================================================================
    logger.info(
      "🎫 Fetching real data for incident and health ticket tables..."
    );

    // Fetch non-health escalation incidents for the "Analysis on Incident Ticket" table
    const incidentTicketsData = await getNonHealthEscalationIncidents(customerKey);

    // Fetch health escalation incidents for the "Analysis on Health Ticket" table
    const healthTicketsData = await getHealthEscalationIncidents(customerKey);

    logger.info(
      `✅ Fetched ${incidentTicketsData.length} incident tickets and ${healthTicketsData.length} health tickets.`
    );
    // ========================================================================
    // END: FETCH REAL TICKET DATA
    // ========================================================================

    // Define the legend data for substatus chart
    const subStatusLegend = [
      { label: "SOC Investigating", color: "#0066ff" },
      { label: "Tuning", color: "#ffcc00" },
      { label: "Awaiting Customer Response", color: "#ff8c00" },
      { label: "False Positive", color: "#00cc00" },
      { label: "True Positive", color: "#ff0000" }
    ];

    // Return the data object
    return {
      reportMonth,
      // ✅ UPDATED: Use customer display name in title
      customerDisplayName,
      
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
      subStatusLegend, // Add legend data for sub-status chart
      incidentSubStatusData,

      // ✅ UPDATED: Real Incident Tickets Data
      incidentTickets: incidentTicketsData,

      // ✅ UPDATED: Real Health Tickets Data
      healthTickets: healthTicketsData,
    };
  } catch (error) {
    logger.error(`❌ Error getting report data for ${customerDisplayName}:`, error);
    throw error;
  }
}

// Function to get report data for all customers
async function getReportData() {
  const allCustomersData = {};
  
  try {
    // Get report data for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(customers)) {
      try {
        const customerData = await getReportDataForCustomer(customerKey, customerDisplayName);
        allCustomersData[customerKey] = customerData;
      } catch (error) {
        logger.error(`❌ Failed to get report data for ${customerDisplayName}:`, error);
        // Continue with other customers even if one fails
      }
    }
    
    return allCustomersData;
  } catch (error) {
    logger.error("❌ Error getting report data for all customers:", error);
    throw error;
  }
}

// Schedule: Run on 1st of every month at 00:00
function scheduleMonthlyReport() {
  schedule.scheduleJob("0 0 1 * *", () => {
    generateMonthlyReport(); // This will now generate reports for the previous month
  });
  logger.info(
    "📅 Monthly report generation scheduled for 1st of every month at 00:00 for all customers (previous month)"
  );
}

export { 
  generateMonthlyReport, 
  generateAllHistoricalReports, // ✅ NEW: Export the historical reports function
  getReportData, 
  scheduleMonthlyReport, 
  customers 
};