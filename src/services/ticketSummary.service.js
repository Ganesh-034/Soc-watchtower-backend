import { AzureOpenAI } from "openai";
import "@azure/openai/types";
import logger from "../config/logger.js";

export async function generateTicketSummary(tickets, type, reportMonth) {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID;

    if (!endpoint || !apiKey || !deploymentId) {
      logger.error(
        `Azure OpenAI credentials not configured for ${type} ticket summary`
      );
      return getDefaultTicketSummary(tickets, type, reportMonth);
    }

    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      deployment: deploymentId,
      apiVersion: "2024-02-15-preview",
    });

    const ticketCount = tickets.length;
    if (ticketCount === 0) {
      return `No ${type.toLowerCase()} tickets were reported during ${reportMonth}.`;
    }

    // Count by status (case-insensitive)
    const statusCounts = {};

    for (const ticket of tickets) {
      const status = ticket.status?.trim().toLowerCase();
      if (status) {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }

    // Map to readable form
    const statusReadable = Object.entries(statusCounts)
      .map(([s, c]) => `${capitalizeStatus(s)}: ${c}`)
      .join(", ");

    const prompt = `
      Write a concise single-sentence summary of ticket handling for a SOC report.
 
      Details:
      - Ticket Type: ${type}
      - Total Tickets: ${ticketCount}
      - By Status: ${statusReadable}
      - Report Month: ${reportMonth}
 
      Use this sentence pattern exactly:
      "For the month of ${reportMonth}, our team handled ${ticketCount} ${type.toLowerCase()} tickets, out of which <status1count> are in <status1> and <status2count> are in <status2>."
 
      Replace <status1> etc. with real status names from the list above.
      Only include the <status2> section in your report if there are one or more unresolved tickets in either the incident analysis and health ticket categories
      Use natural grammar (singular/plural) and correct phrasing.
      Avoid extra commentary or introductions.
    `;
    logger.info(
      `🧠 Ticket summary Azure OpenAI for ${prompt} ticket summary generation`
    );
    logger.info(
      `🧠 Calling Azure OpenAI for ${type} ticket summary generation`
    );
    const response = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 100,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (summary) {
      logger.info(`✅ Successfully generated ${type} ticket summary`);
      return summary;
    } else {
      logger.warn(
        `⚠️ Empty response from Azure OpenAI for ${type} ticket summary`
      );
      return getDefaultTicketSummary(tickets, type, reportMonth);
    }
  } catch (error) {
    logger.error(`❌ Error generating ${type} ticket summary:`, error);
    return getDefaultTicketSummary(tickets, type, reportMonth);
  }
}

function getDefaultTicketSummary(tickets, type, reportMonth) {
  const count = tickets.length;
  if (count === 0) {
    return `No ${type.toLowerCase()} tickets were reported during ${reportMonth}.`;
  }

  const statusCounts = {};
  for (const ticket of tickets) {
    const status = ticket.status?.trim().toLowerCase();
    if (status) {
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  }

  const statuses = Object.entries(statusCounts);
  const readableStatuses = statuses
    .map(([status, num]) => `${num} are in ${capitalizeStatus(status)}`)
    .join(" and ");

  return `For the month of ${reportMonth}, our team handled ${count} ${type.toLowerCase()} tickets, out of which ${readableStatuses}.`;
}

function capitalizeStatus(status) {
  return status
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
