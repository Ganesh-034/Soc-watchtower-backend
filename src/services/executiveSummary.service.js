// CORRECTED IMPORT based on the official example
// The main class is imported from the "openai" package.
// The types import is necessary for Azure-specific configurations.
import { AzureOpenAI } from "openai";
import "@azure/openai/types";

import logger from "../config/logger.js";

export async function generateExecutiveSummary(data, customerDisplayName) {
  try {
    // Configure Azure OpenAI credentials
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

    if (!endpoint || !apiKey || !deploymentId) {
      logger.error("Azure OpenAI credentials not configured");
      return getDefaultExecutiveSummary(data, customerDisplayName);
    }

    // UPDATED CLIENT INSTANTIATION based on the example
    // The deploymentId and apiVersion are passed directly to the constructor.
    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      deployment: deploymentId,
      apiVersion: "2024-02-15-preview" // Use a recent API version
    });

    // --- (Data extraction logic remains the same) ---
    const severityMonths = data.severityChartLabels || [];
    const currentMonthIndex = severityMonths.length - 1;
    const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
    const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
    const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
    const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
    
    const detectionSources = [];
    if (data.detectionChartLabels && data.detectionChartData) {
      let sourceData = [];
      if (typeof data.detectionChartData === 'object' && data.detectionChartData.high) {
        for (let i = 0; i < data.detectionChartLabels.length; i++) {
          const high = data.detectionChartData.high[i] || 0;
          const medium = data.detectionChartData.medium[i] || 0;
          const low = data.detectionChartData.low[i] || 0;
          sourceData.push({ name: data.detectionChartLabels[i], count: high + medium + low });
        }
      } else if (Array.isArray(data.detectionChartData)) {
        for (let i = 0; i < data.detectionChartLabels.length; i++) {
          sourceData.push({ name: data.detectionChartLabels[i], count: data.detectionChartData[i] || 0 });
        }
      }
      detectionSources.push(...sourceData.sort((a, b) => b.count - a.count).slice(0, 3).filter(item => item.count > 0).map(item => item.name));
    }
    
    const statusMonths = data.handlingStatusChartLabels || [];
    const currentStatusIndex = statusMonths.length - 1;
    const resolvedCount = data.handlingStatusChartData?.resolved?.[currentStatusIndex] || 0;
    const closedCount = data.handlingStatusChartData?.closed?.[currentStatusIndex] || 0;
    const pendingCount = data.handlingStatusChartData?.pending?.[currentStatusIndex] || 0;
    const openCount = data.handlingStatusChartData?.open?.[currentStatusIndex] || 0;
    const totalHandled = resolvedCount + closedCount + pendingCount + openCount;
    const resolutionRate = totalHandled > 0 ? Math.round(((resolvedCount + closedCount) / totalHandled) * 100) : 90;
    const incidentTicketsCount = data.incidentTickets?.length || 0;
    const healthTicketsCount = data.healthTickets?.length || 0;
    // --- End of data extraction ---

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
    
    // UPDATED API CALL based on the example
    // Since 'deployment' is in the client constructor, the 'model' parameter is not needed here.
    const response = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    // Response parsing remains the same for the non-streaming call
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

// Default summary function (no changes needed)
function getDefaultExecutiveSummary(data, customerDisplayName) {
  const severityMonths = data.severityChartLabels || [];
  const currentMonthIndex = severityMonths.length - 1;
  const highSeverityCount = data.severityChartData?.high?.[currentMonthIndex] || 0;
  const mediumSeverityCount = data.severityChartData?.medium?.[currentMonthIndex] || 0;
  const lowSeverityCount = data.severityChartData?.low?.[currentMonthIndex] || 0;
  const totalIncidents = highSeverityCount + mediumSeverityCount + lowSeverityCount;
  
  return `This executive summary covers security operations for ${customerDisplayName} during ${data.reportMonth}. The Global Security Operations Center has been actively monitoring and responding to security incidents. This month saw a total of ${totalIncidents} incidents, with ${highSeverityCount} high severity incidents that required immediate attention. The majority of incidents were detected through our automated monitoring systems. Our team has successfully resolved the majority of incidents within the SLA timeframe.`;
}