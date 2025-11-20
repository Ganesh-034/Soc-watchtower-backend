

// import { AzureOpenAI } from "openai";
// import "@azure/openai/types";

// import logger from "../config/logger.js";

// // Helper function to analyze incident tickets
// function analyzeIncidentTickets(tickets) {
//   if (!tickets || tickets.length === 0) {
//     return {
//       total: 0,
//       priority: { High: 0, Medium: 0, Low: 0 },
//       status: {},
//       summary: "No incident tickets were escalated this month."
//     };
//   }

//   const priorityCount = { High: 0, Medium: 0, Low: 0 };
//   const statusCount = {};

//   tickets.forEach(ticket => {
//     // Count by priority
//     if (ticket.priority && priorityCount.hasOwnProperty(ticket.priority)) {
//       priorityCount[ticket.priority]++;
//     }
    
//     // Count by status
//     if (ticket.status) {
//       statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
//     }
//   });

//   // Create summary string
//   const prioritySummary = Object.entries(priorityCount)
//     .filter(([_, count]) => count > 0)
//     .map(([priority, count]) => `${count} ${priority}`)
//     .join(', ');

//   const statusSummary = Object.entries(statusCount)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 3) // Top 3 statuses
//     .map(([status, count]) => `${count} ${status}`)
//     .join(', ');

//   return {
//     total: tickets.length,
//     priority: priorityCount,
//     status: statusCount,
//     summary: `The team handled ${tickets.length} incident tickets. By priority: ${prioritySummary}. By status: ${statusSummary}.`
//   };
// }

// // Helper function to analyze health tickets
// function analyzeHealthTickets(tickets) {
//   if (!tickets || tickets.length === 0) {
//     return {
//       total: 0,
//       systems: {},
//       status: {},
//       summary: "No health tickets were escalated this month."
//     };
//   }

//   const systemCount = {};
//   const statusCount = {};

//   tickets.forEach(ticket => {
//     // Count by system
//     if (ticket.incidentType) {
//       systemCount[ticket.incidentType] = (systemCount[ticket.incidentType] || 0) + 1;
//     }
    
//     // Count by status
//     if (ticket.status) {
//       statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
//     }
//   });

//   // Create summary string
//   const systemSummary = Object.entries(systemCount)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 3) // Top 3 systems
//     .map(([system, count]) => `${count} ${system}`)
//     .join(', ');

//   const statusSummary = Object.entries(statusCount)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, 3) // Top 3 statuses
//     .map(([status, count]) => `${count} ${status}`)
//     .join(', ');

//   return {
//     total: tickets.length,
//     systems: systemCount,
//     status: statusCount,
//     summary: `System health monitoring identified ${tickets.length} health tickets. By system: ${systemSummary}. By status: ${statusSummary}.`
//   };
// }

// export async function generateExecutiveSummary(data, customerDisplayName) {
//   try {
//     // Configure Azure OpenAI credentials
//     const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
//     const apiKey = process.env.AZURE_OPENAI_KEY;
//     const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

//     if (!endpoint || !apiKey || !deploymentId) {
//       logger.error("Azure OpenAI credentials not configured");
//       return getDefaultExecutiveSummary(data, customerDisplayName);
//     }

//     // Client instantiation
//     const client = new AzureOpenAI({
//       endpoint,
//       apiKey,
//       deployment: deploymentId,
//       apiVersion: "2024-02-15-preview"
//     });

//     // Data extraction
//     const severityMonths = data.severityChartLabels || [];
//     const currentMonthIndex = severityMonths.length - 1;
//     const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
//     const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
//     const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
//     const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;


    
//     const detectionSources = [];
//     if (data.detectionChartLabels && data.detectionChartData) {
//       let sourceData = [];
//       if (typeof data.detectionChartData === 'object' && data.detectionChartData.high) {
//         for (let i = 0; i < data.detectionChartLabels.length; i++) {
//           const high = data.detectionChartData.high[i] || 0;
//           const medium = data.detectionChartData.medium[i] || 0;
//           const low = data.detectionChartData.low[i] || 0;
//           sourceData.push({ name: data.detectionChartLabels[i], count: high + medium + low });
//         }
//       } else if (Array.isArray(data.detectionChartData)) {
//         for (let i = 0; i < data.detectionChartLabels.length; i++) {
//           sourceData.push({ name: data.detectionChartLabels[i], count: data.detectionChartData[i] || 0 });
//         }
//       }
//       detectionSources.push(...sourceData.sort((a, b) => b.count - a.count).slice(0, 3).filter(item => item.count > 0).map(item => item.name));
//     }
    
//     const statusMonths = data.handlingStatusChartLabels || [];
//     const currentStatusIndex = statusMonths.length - 1;
//     const resolvedCount = data.handlingStatusChartData?.resolved?.[currentStatusIndex] || 0;
//     const closedCount = data.handlingStatusChartData?.closed?.[currentStatusIndex] || 0;
//     const pendingCount = data.handlingStatusChartData?.pending?.[currentStatusIndex] || 0;
//     const openCount = data.handlingStatusChartData?.open?.[currentStatusIndex] || 0;

//     // Analyze tickets
//     const incidentAnalysis = analyzeIncidentTickets(data.incidentTickets);
//     const healthAnalysis = analyzeHealthTickets(data.healthTickets);

//     // Prompt with detailed ticket analysis
//     const prompt = `
//       Generate an executive summary for a security operations monthly report for ${customerDisplayName} for ${data.reportMonth}.
//       Include the following key metrics from our charts and tables:
      
//       - Incident by Severity chart shows a total of ${totalIncidents} incidents:
//         * High severity: ${highSeverityCount}
//         * Medium severity: ${mediumSeverityCount}
//         * Low severity: ${lowSeverityCount}
      
//       - Detection Source chart shows the top sources were: ${detectionSources.join(', ')}
      
//       - Handling Status chart shows:
//         * Resolved: ${resolvedCount}
//         * Closed: ${closedCount}
//         * Pending: ${pendingCount}
//         * Open: ${openCount}
      
//       - For Sub Status, the report shows the distribution of incidents by detailed status
      
//       - Incident Tickets Analysis: ${incidentAnalysis.summary}
      
//       - Health Tickets Analysis: ${healthAnalysis.summary}
      
//       Write a professional executive summary of about 150 words that highlights these metrics.
//       Focus on security operations for this specific customer, mentioning their name.
//       Use concise, factual language suitable for a formal report.
//       Do not include any text styling, formatting, or emphasis such as bold or italics.
//     `;
//     logger.info(`totallllllllllll ${totalIncidents}`);
//     logger.info(`🧠 Calling Azure OpenAI for ${customerDisplayName} executive summary generation`);

//     const response = await client.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0.7,
//       max_tokens: 350,
//     });

//     const summary = response.choices[0]?.message?.content?.trim();
    
//     if (summary) {
//       logger.info(`✅ Successfully generated executive summary for ${customerDisplayName}`);
//       return summary;
//     } else {
//       logger.warn(`⚠️ Empty response from Azure OpenAI for ${customerDisplayName}`);
//       return getDefaultExecutiveSummary(data, customerDisplayName);
//     }
//   } catch (error) {
//     logger.error(`❌ Error generating executive summary for ${customerDisplayName}:`, error);
//     return getDefaultExecutiveSummary(data, customerDisplayName);
//   }
// }

// // Default summary function
// function getDefaultExecutiveSummary(data, customerDisplayName) {
//   const severityMonths = data.severityChartLabels || [];
//   const currentMonthIndex = severityMonths.length - 1;
//   const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
//   const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
//   const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
//   const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
  
//   // Analyze tickets for default summary
//   const incidentAnalysis = analyzeIncidentTickets(data.incidentTickets);
//   const healthAnalysis = analyzeHealthTickets(data.healthTickets);
  
//   return `This executive summary covers security operations for ${customerDisplayName} during ${data.reportMonth}. The Global Security Operations Center has been actively monitoring and responding to security incidents. This month saw a total of ${totalIncidents} incidents, with ${highSeverityCount} high severity incidents that required immediate attention. ${incidentAnalysis.summary} ${healthAnalysis.summary} Our team has successfully resolved the majority of incidents within the SLA timeframe.`;
// }


import { AzureOpenAI } from "openai";
import "@azure/openai/types";
 
import logger from "../config/logger.js";
 
// Helper function to analyze incident tickets
function analyzeIncidentTickets(tickets) {
  if (!tickets || tickets.length === 0) {
    return {
      total: 0,
      priority: { High: 0, Medium: 0, Low: 0 },
      status: {},
      summary: "No incident tickets were escalated this month."
    };
  }
 
  const priorityCount = { High: 0, Medium: 0, Low: 0 };
  const statusCount = {};
 
  tickets.forEach(ticket => {
    // Count by priority
    if (ticket.priority && priorityCount.hasOwnProperty(ticket.priority)) {
      priorityCount[ticket.priority]++;
    }
    // Count by status
    if (ticket.status) {
      statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
    }
  });
 
  // Create summary string
  const prioritySummary = Object.entries(priorityCount)
    .filter(([_, count]) => count > 0)
    .map(([priority, count]) => `${count} ${priority}`)
    .join(', ');
 
  const statusSummary = Object.entries(statusCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3) // Top 3 statuses
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
 
  return {
    total: tickets.length,
    priority: priorityCount,
    status: statusCount,
    summary: `The team handled ${tickets.length} incident tickets. By priority: ${prioritySummary}. By status: ${statusSummary}.`
  };
}
 
// Helper function to analyze health tickets
function analyzeHealthTickets(tickets) {
  if (!tickets || tickets.length === 0) {
    return {
      total: 0,
      systems: {},
      status: {},
      summary: "No health tickets were escalated this month."
    };
  }
 
  const systemCount = {};
  const statusCount = {};
 
  tickets.forEach(ticket => {
    // Count by system
    if (ticket.incidentType) {
      systemCount[ticket.incidentType] = (systemCount[ticket.incidentType] || 0) + 1;
    }
    // Count by status
    if (ticket.status) {
      statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
    }
  });
 
  // Create summary string
  const systemSummary = Object.entries(systemCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3) // Top 3 systems
    .map(([system, count]) => `${count} ${system}`)
    .join(', ');
 
  const statusSummary = Object.entries(statusCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3) // Top 3 statuses
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
 
  return {
    total: tickets.length,
    systems: systemCount,
    status: statusCount,
    summary: `System health monitoring identified ${tickets.length} health tickets. By system: ${systemSummary}. By status: ${statusSummary}.`
  };
}
export async function generateExecutiveSummary(data, customerDisplayName) {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;
 
    if (!endpoint || !apiKey || !deploymentId) {
      logger.error("Azure OpenAI credentials not configured");
      return getDefaultExecutiveSummary(data, customerDisplayName);
    }
 
    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      deployment: deploymentId,
      apiVersion: "2024-02-15-preview"
    });
 
    // === INCIDENT SEVERITY ===
    const severityMonths = data.severityChartLabels || [];
    const currentMonthIndex = severityMonths.length - 1;
    const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
    const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
    const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
    const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
 
    // === DETECTION SOURCES (with counts) ===
    let detectionSources = [];
    if (data.detectionChartLabels && data.detectionChartData) {
      if (typeof data.detectionChartData === "object" && data.detectionChartData.high) {
        for (let i = 0; i < data.detectionChartLabels.length; i++) {
          const high = data.detectionChartData.high[i] || 0;
          const medium = data.detectionChartData.medium[i] || 0;
          const low = data.detectionChartData.low[i] || 0;
          const total = high + medium + low;
          if (total > 0) detectionSources.push({ name: data.detectionChartLabels[i], count: total });
        }
      } else if (Array.isArray(data.detectionChartData)) {
        for (let i = 0; i < data.detectionChartLabels.length; i++) {
          const total = data.detectionChartData[i] || 0;
          if (total > 0) detectionSources.push({ name: data.detectionChartLabels[i], count: total });
        }
      }
    }
 
    detectionSources = detectionSources
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // top 3 only
 
    const detectionSourcesText = detectionSources.length
      ? detectionSources.map(s => `${s.name} (${s.count})`).join(", ")
      : "None";
 
    // === HANDLING STATUS ===
    const statusMonths = data.handlingStatusChartLabels || [];
    const currentStatusIndex = statusMonths.length - 1;
    const resolvedCount = data.handlingStatusChartData?.resolved?.[currentStatusIndex] || 0;
    const closedCount = data.handlingStatusChartData?.closed?.[currentStatusIndex] || 0;
    const pendingCount = data.handlingStatusChartData?.pending?.[currentStatusIndex] || 0;
    const openCount = data.handlingStatusChartData?.open?.[currentStatusIndex] || 0;
 
    // === SUBSTATUS (True Positive / False Positive) ===
    let truePositiveCount = 0;
    let falsePositiveCount = 0;
    if (data.subStatusChartLabels && data.subStatusChartData) {
      for (let i = 0; i < data.subStatusChartLabels.length; i++) {
        const label = data.subStatusChartLabels[i]?.toLowerCase();
        const value = data.subStatusChartData[i] || 0;
        if (label.includes("true")) truePositiveCount += value;
        if (label.includes("false")) falsePositiveCount += value;
      }
    }
 
    // === HEALTH TICKETS COUNT ===
    const totalHealthTickets = Array.isArray(data.healthTickets) ? data.healthTickets.length : 0;
 
    // === PROMPT ===
    // const prompt = `
    //   You are generating a concise, factual executive summary for a SOC monthly report
    //   for the customer "${customerDisplayName}" for ${data.reportMonth}.
    //   Use the data below to write exactly 3 bullet points:
    //   - Total incidents: ${totalIncidents} (High: ${highSeverityCount}, Medium: ${mediumSeverityCount}, Low: ${lowSeverityCount})
    //   - Top detection sources (with counts): ${detectionSourcesText}
    //   - Handling status: Resolved: ${resolvedCount}, Closed: ${closedCount}, Pending: ${pendingCount}, Open: ${openCount}
    //   - True Positive: ${truePositiveCount}, False Positive: ${falsePositiveCount}
    //   - Health Tickets: ${totalHealthTickets}
 
    //   Format strictly as bullet points using "•".
    //   Each point should be one clear sentence. Use the following example style and tone:
    //   • 3 incidents were reported for the month of October 25, detected from O365 (5), AzureAD (3), and Defender (2).
    //   • 1 incident was True Positive and 2 were False Positive with High severity.
    //   • 0 health tickets got triggered on the dashboard for the month of October 25.
 
    //   Keep numbers factual and avoid speculation or generic statements.
    // `;
    const prompt = `
      You are generating a concise, factual executive summary for a SOC monthly report
      for the customer "${customerDisplayName}" for ${data.reportMonth}.
      Use the data below to write exactly 3 bullet points:
      1st point - Total incidents: ${totalIncidents}, all are in resolved state, Top detection sources (with counts): ${detectionSourcesText}
      2nd point - False Positive: ${falsePositiveCount}, True Positive: ${truePositiveCount}, Severity breakdown: High: ${highSeverityCount}, Medium: ${mediumSeverityCount}, Low: ${lowSeverityCount}
      3rd point - Health Tickets: ${totalHealthTickets}

      Format strictly as bullet points using "•".
      Each point should be one clear sentence. Use the following example style and tone:
      • 3 incidents were reported for the month of October 25, all in resolved state, detected from various sources Entra id, 0365 etc
      • 2 incidents are false positive, and 1 incident is True positive with Medium severity.
      • 2 health tickets got triggered on the dashboard for the month of October 25.
		
      Keep numbers factual and avoid speculation or generic statements.
    `;
    
logger.info(`🧠 Calling Azure OpenAI for ${prompt} executive summary generation`);
    logger.info(`🧠 Calling Azure OpenAI for ${customerDisplayName} executive summary generation`);
 
    const response = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 250,
    });
 
    const summary = response.choices[0]?.message?.content?.trim();
 
    if (summary) {
      logger.info(`✅ Successfully generated executive summary for ${customerDisplayName}`);
      return summary;
    } else {
      logger.warn(`⚠️ Empty response from Azure OpenAI for ${customerDisplayName}`);
      return getDefaultExecutiveSummary(data, customerDisplayName);
    }
  } catch (error) {
    logger.error(`❌ Error generating executive summary for ${customerDisplayName}:`, error);
    return getDefaultExecutiveSummary(data, customerDisplayName);
  }
}