

// import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
// import logger from "../config/logger.js";

// export async function generateExecutiveSummary(reportData) {
//   try {
//     // Configure Azure OpenAI client
//     const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
//     const apiKey = process.env.AZURE_OPENAI_KEY;
//     const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

//     if (!endpoint || !apiKey || !deploymentId) {
//       logger.error("Azure OpenAI credentials not configured");
//       return getDefaultExecutiveSummary(reportData);
//     }

//     const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));

//     // Extract chart data for the summary - USING ONLY DATA VISIBLE IN THE CHARTS
    
//     // 1. Chart 1: Incident by Severity
//     const severityMonths = reportData.severityChartLabels || [];
//     const currentMonthIndex = severityMonths.length - 1; // Last month is current month
    
//     // High severity from the chart data
//     const highSeverityCount = reportData.severityChartData?.high?.[currentMonthIndex] || 0;
    
//     // Medium severity from the chart data
//     const mediumSeverityCount = reportData.severityChartData?.medium?.[currentMonthIndex] || 0;
    
//     // Low severity from the chart data
//     const lowSeverityCount = reportData.severityChartData?.low?.[currentMonthIndex] || 0;
    
//     // Total incidents (sum of all severities)
//     const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
    
//     // 2. Chart 2: Incident by Detection Source
//     // Get top detection sources directly from chart labels and data
//     const detectionSources = [];
//     if (reportData.detectionChartLabels && reportData.detectionChartData) {
//       let sourceData = [];
      
//       // Handle different data structures
//       if (typeof reportData.detectionChartData === 'object' && reportData.detectionChartData.high) {
//         // For data structured by severity
//         for (let i = 0; i < reportData.detectionChartLabels.length; i++) {
//           const high = reportData.detectionChartData.high[i] || 0;
//           const medium = reportData.detectionChartData.medium[i] || 0;
//           const low = reportData.detectionChartData.low[i] || 0;
//           const total = high + medium + low;
          
//           sourceData.push({
//             name: reportData.detectionChartLabels[i],
//             count: total
//           });
//         }
//       } else if (Array.isArray(reportData.detectionChartData)) {
//         // For simple array data
//         for (let i = 0; i < reportData.detectionChartLabels.length; i++) {
//           sourceData.push({
//             name: reportData.detectionChartLabels[i],
//             count: reportData.detectionChartData[i] || 0
//           });
//         }
//       }
      
//       // Sort and get top sources
//       detectionSources.push(...sourceData
//         .sort((a, b) => b.count - a.count)
//         .slice(0, 3)
//         .filter(item => item.count > 0)
//         .map(item => item.name));
//     }
    
//     // 3. Chart 3: Incident by Handling Status
//     // Get resolution data from chart
//     const statusMonths = reportData.handlingStatusChartLabels || [];
//     const currentStatusIndex = statusMonths.length - 1; // Last month is current
    
//     const resolvedCount = reportData.handlingStatusChartData?.resolved?.[currentStatusIndex] || 0;
//     const closedCount = reportData.handlingStatusChartData?.closed?.[currentStatusIndex] || 0;
//     const pendingCount = reportData.handlingStatusChartData?.pending?.[currentStatusIndex] || 0;
//     const openCount = reportData.handlingStatusChartData?.open?.[currentStatusIndex] || 0;
    
//     // Calculate resolution rate from the chart data
//     const totalHandled = resolvedCount + closedCount + pendingCount + openCount;
//     const resolutionRate = totalHandled > 0 
//       ? Math.round(((resolvedCount + closedCount) / totalHandled) * 100)
//       : 90; // Default if no data
      
//     // Create the prompt for GPT with only data from the charts
//     const prompt = `
//       Generate an executive summary for a security operations monthly report for ${reportData.reportMonth}.
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
//         * This gives a resolution rate of ${resolutionRate}%
      
//       - For Sub Status, refer to the distribution shown in the fourth chart
      
//       The report also includes details on ${reportData.incidentTickets?.length || 0} incident tickets 
//       and ${reportData.healthTickets?.length || 0} health tickets that required customer escalation.
      
//       Write a professional executive summary of about 100 words that highlights these metrics.
//     `;

//     logger.info("Calling Azure OpenAI for executive summary generation");
    
//     // Call Azure OpenAI
//     const response = await client.getCompletions(deploymentId, [prompt], {
//       temperature: 0.7,
//       maxTokens: 200,
//     });

//     const summary = response.choices[0]?.text.trim();
    
//     if (summary) {
//       logger.info("Successfully generated executive summary");
//       return summary;
//     } else {
//       logger.warn("Empty response from Azure OpenAI");
//       return getDefaultExecutiveSummary(reportData);
//     }
//   } catch (error) {
//     logger.error("Error generating executive summary:", error);
//     return getDefaultExecutiveSummary(reportData);
//   }
// }

// // Default summary in case of failure
// function getDefaultExecutiveSummary(reportData) {
//   // Use the same chart-based data extraction for consistency
//   const severityMonths = reportData.severityChartLabels || [];
//   const currentMonthIndex = severityMonths.length - 1;
  
//   const highSeverityCount = reportData.severityChartData?.high?.[currentMonthIndex] || 0;
//   const mediumSeverityCount = reportData.severityChartData?.medium?.[currentMonthIndex] || 0;
//   const lowSeverityCount = reportData.severityChartData?.low?.[currentMonthIndex] || 0;
  
//   const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
  
//   return `This executive summary covers the security operations for ${reportData.reportMonth}. The Global Security Operations Center has been actively monitoring and responding to security incidents for centralmotorwheel-thailand. This month saw a total of ${totalIncidents} incidents, with ${highSeverityCount} high severity incidents that required immediate attention. The majority of incidents were detected through our automated monitoring systems. Our team has successfully resolved the majority of incidents within the SLA timeframe.`;
// }












import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import logger from "../config/logger.js";

export async function generateExecutiveSummary(data, customerDisplayName) {
  try {
    // Configure Azure OpenAI client
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

    if (!endpoint || !apiKey || !deploymentId) {
      logger.error("Azure OpenAI credentials not configured");
      return getDefaultExecutiveSummary(data, customerDisplayName);
    }

    const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));

    // Extract chart data for the summary
    const severityMonths = data.severityChartLabels || [];
    const currentMonthIndex = severityMonths.length - 1; // Last month is current month
    
    // High severity from the chart data
    const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
    
    // Medium severity from the chart data
    const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
    
    // Low severity from the chart data
    const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
    
    // Total incidents (sum of all severities)
    const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
    
    // Get top detection sources directly from chart labels and data
    const detectionSources = [];
    if (data.detectionChartLabels && data.detectionChartData) {
      let sourceData = [];
      
      // Handle different data structures
      if (typeof data.detectionChartData === 'object' && data.detectionChartData.high) {
        // For data structured by severity
        for (let i = 0; i < data.detectionChartLabels.length; i++) {
          const high = data.detectionChartData.high[i] || 0;
          const medium = data.detectionChartData.medium[i] || 0;
          const low = data.detectionChartData.low[i] || 0;
          const total = high + medium + low;
          
          sourceData.push({
            name: data.detectionChartLabels[i],
            count: total
          });
        }
      } else if (Array.isArray(data.detectionChartData)) {
        // For simple array data
        for (let i = 0; i < data.detectionChartLabels.length; i++) {
          sourceData.push({
            name: data.detectionChartLabels[i],
            count: data.detectionChartData[i] || 0
          });
        }
      }
      
      // Sort and get top sources
      detectionSources.push(...sourceData
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .filter(item => item.count > 0)
        .map(item => item.name));
    }
    
    // Get resolution data from chart
    const statusMonths = data.handlingStatusChartLabels || [];
    const currentStatusIndex = statusMonths.length - 1; // Last month is current
    
    const resolvedCount = data.handlingStatusChartData?.resolved?.[currentStatusIndex] || 0;
    const closedCount = data.handlingStatusChartData?.closed?.[currentStatusIndex] || 0;
    const pendingCount = data.handlingStatusChartData?.pending?.[currentStatusIndex] || 0;
    const openCount = data.handlingStatusChartData?.open?.[currentStatusIndex] || 0;
    
    // Calculate resolution rate from the chart data
    const totalHandled = resolvedCount + closedCount + pendingCount + openCount;
    const resolutionRate = totalHandled > 0 
      ? Math.round(((resolvedCount + closedCount) / totalHandled) * 100)
      : 90; // Default if no data

    // Get incident and health ticket counts
    const incidentTicketsCount = data.incidentTickets?.length || 0;
    const healthTicketsCount = data.healthTickets?.length || 0;
      
    // Create the prompt for GPT with data from the charts
    const prompt = `
      Generate an executive summary for a security operations monthly report for ${customerDisplayName} for ${data.reportMonth}.
      Include the following key metrics from our charts and tables:
      
      - Incident by Severity chart shows a total of ${totalIncidents} incidents:
        * High severity: ${highSeverityCount}
        * Medium severity: ${mediumSeverityCount}
        * Low severity: ${lowSeverityCount}
      
      - Detection Source chart shows the top sources were: ${detectionSources.join(', ')}
      
      - Handling Status chart shows:
        * Resolved: ${resolvedCount}
        * Closed: ${closedCount}
        * Pending: ${pendingCount}
        * Open: ${openCount}
        * This gives a resolution rate of ${resolutionRate}%
      
      - For Sub Status, the report shows the distribution of incidents by detailed status
      
      - The report also includes details on ${incidentTicketsCount} incident tickets 
        and ${healthTicketsCount} health tickets that required customer escalation.
      
      Write a professional executive summary of about 100 words that highlights these metrics.
      Focus on security operations for this specific customer, mentioning their name.
      Use concise, factual language suitable for a formal report.
    `;

    logger.info(`🧠 Calling Azure OpenAI for ${customerDisplayName} executive summary generation`);
    
    // Call Azure OpenAI
    const response = await client.getCompletions(deploymentId, [prompt], {
      temperature: 0.7,
      maxTokens: 300,
    });

    const summary = response.choices[0]?.text.trim();
    
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

// Default summary in case of failure
function getDefaultExecutiveSummary(data, customerDisplayName) {
  // Use the same chart-based data extraction for consistency
  const severityMonths = data.severityChartLabels || [];
  const currentMonthIndex = severityMonths.length - 1;
  
  const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
  const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
  const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
  
  const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
  
  return `This executive summary covers security operations for ${customerDisplayName} during ${data.reportMonth}. The Global Security Operations Center has been actively monitoring and responding to security incidents. This month saw a total of ${totalIncidents} incidents, with ${highSeverityCount} high severity incidents that required immediate attention. The majority of incidents were detected through our automated monitoring systems. Our team has successfully resolved the majority of incidents within the SLA timeframe.`;
}