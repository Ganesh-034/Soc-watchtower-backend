// import axios from "axios";
// import https from "https";
// import { ApiError } from "../utils/ApiError.js";
// import logger from "../config/logger.js";
// import Incident from "../models/incident.model.js";

// export const getIncidentDetails = async (incidentId, customerName) => {
//   try {
//     if (!incidentId || !customerName) {
//       throw new Error(
//         "Both incidentId and customerName are required for fetching incident details."
//       );
//     }

//     const incident = await Incident.findOne({
//       _id: incidentId,
//       customer_name: customerName,
//     });

//     if (!incident) {
//       logger.warn(
//         `Unauthorized access attempt: User from customer "${customerName}" tried to access incident ID "${incidentId}" which does not belong to them.`
//       );
//       throw new ApiError(
//         404,
//         "Incident not found or you do not have permission to view it."
//       );
//     }

//     const username = "Soc-Watchtower";
//     const password = "123";
//     const auth = Buffer.from(`${username}:${password}`).toString("base64");

//     const instance = axios.create({
//       httpsAgent: new https.Agent({
//         rejectUnauthorized: false,
//       }),
//     });

//     const response = await instance.post(
//       "https://ddfdfdfdf", // The URL for the external API call
//       incidentId,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Basic ${auth}`,
//         },
//       }
//     );

//     logger.info(
//       `Incident details fetched for ID: ${incidentId} for customer: ${customerName}`
//     );
//     return response.data;
//   } catch (error) {
//     logger.error(
//       `Error fetching incident details for ID ${incidentId}: ${error.message}`
//     );

//     if (error.response) {
//       logger.error(`Response status: ${error.response.status}`);
//       logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
//     }

//     if (error instanceof ApiError) {
//       throw error;
//     }

//     throw new ApiError(
//       error.response?.status || 500,
//       error.response?.data?.message || "Failed to fetch incident details"
//     );
//   }
// };






// import axios from "axios";
// import https from "https";
// import { ApiError } from "../utils/ApiError.js";
// import logger from "../config/logger.js";
// import Incident from "../models/incident.model.js";

// export const getIncidentDetails = async (incidentId, customerName) => {
//   try {
//     if (!incidentId || !customerName) {
//       throw new ApiError(400, "Both incidentId and customerName are required.");
//     }

//     // 1️⃣ Fetch from MongoDB
//     const incident = await Incident.findOne({
//       _id: incidentId,
//       customer_name: customerName,
//     }).lean();

//     if (!incident) {
//       logger.warn(
//         `Unauthorized access attempt: User from "${customerName}" tried to access incident ID "${incidentId}".`
//       );
//       throw new ApiError(404, "Incident not found or access denied.");
//     }

//     // 2️⃣ Prepare prompt for Azure OpenAI
//     const prompt = `
//     You are a cybersecurity analyst. Generate a concise incident summary for ${customerName}.
//     Include key details such as:
//     - Incident title, type, severity, and sub-status
//     - Description and analysis summary
//     - SOC recommendation if available
//     - Any Sentinel or ticket references if present
//     Keep the tone factual and suitable for a formal incident report.
//     Do not add styling or markdown formatting.

//     Incident data:
//     ${JSON.stringify(incident, null, 2)}
//     `;

//     // 3️⃣ Call Azure OpenAI API
//     const endpoint = process.env.AZURE_OPENAI_ENDPOINT; // e.g. "https://soc-openai-eastus.openai.azure.com/"
//     const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_ID; // e.g. "gpt-4o-mini" or "gpt-35-turbo"
//     const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";
//     const apiKey = process.env.AZURE_OPENAI_KEY;

//     if (!endpoint || !deployment || !apiKey) {
//       throw new ApiError(
//         500,
//         "Azure OpenAI configuration missing. Please check environment variables."
//       );
//     }

//     const response = await axios.post(
//       `${endpoint}`,
//       {
//         messages: [
//           {
//             role: "system",
//             content: "You are a helpful cybersecurity report summarizer.",
//           },
//           {
//             role: "user",
//             content: prompt,
//           },
//         ],
//         temperature: 0.4,
//         max_tokens: 500,
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "api-key": apiKey,
//         },
//         httpsAgent: new https.Agent({
//           rejectUnauthorized: false,
//         }),
//       }
//     );

//     const summary = response.data?.choices?.[0]?.message?.content?.trim();

//     logger.info(
//       `✅ Azure OpenAI summary generated for incident ID: ${incidentId} (Customer: ${customerName})`
//     );

//     return {
//       incidentDetails: incident,
//       executiveSummary: summary || "No summary generated.",
//     };
//   } catch (error) {
//     logger.error(
//       `❌ Error fetching/generating summary for incident ${incidentId}: ${error.message}`
//     );

//     if (error.response) {
//       logger.error(`Response status: ${error.response.status}`);
//       logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
//     }

//     if (error instanceof ApiError) throw error;

//     throw new ApiError(
//       error.response?.status || 500,
//       error.response?.data?.error?.message ||
//         "Failed to fetch or summarize incident details."
//     );
//   }
// };







import axios from "axios";
import https from "https";
import { ApiError } from "../utils/ApiError.js";
import logger from "../config/logger.js";
import Incident from "../models/incident.model.js";

export const getIncidentDetails = async (incidentId, customerName) => {
  try {
    if (!incidentId || !customerName) {
      throw new Error(
        "Both incidentId and customerName are required for fetching incident details."
      );
    }

    // 1️⃣ Fetch the incident from MongoDB
    const incident = await Incident.findOne({
      _id: incidentId,
      customer_name: customerName,
    });

    if (!incident) {
      logger.warn(
        `Unauthorized access attempt: User from customer "${customerName}" tried to access incident ID "${incidentId}" which does not belong to them.`
      );
      throw new ApiError(
        404,
        "Incident not found or you do not have permission to view it."
      );
    }

    logger.info(`Incident fetched for ID: ${incidentId}`);

    // 2️⃣ Prepare prompt for Azure OpenAI
    const prompt = `
You'll get the SOC Ticket details in JSON format, your task is to understand the details provided to you and based on that generate a good summary on what happened, when happened and what was done basically a good summary for anyone, dont assume or recommend anything just summarize. Do NOT use any markdown formatting, bold, italics, asterisks, headings, or special characters. Provide plain text only.

Incident Details:
${JSON.stringify(incident, null, 2)}
    `;

    // 3️⃣ Send request to Azure OpenAI
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT; // e.g. https://myopenai-resource.openai.azure.com
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_ID; // e.g. "gpt-4o-mini"
    const apiKey = process.env.AZURE_OPENAI_KEY;

    if (!azureEndpoint || !deploymentName || !apiKey) {
      throw new Error("Azure OpenAI configuration missing.");
    }

    const aiResponse = await axios.post(
      `${azureEndpoint}`,
      {
        messages: [
          { role: "system", content: "You are a helpful SOC analyst." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    const summary =
      aiResponse.data.choices?.[0]?.message?.content ||
      "No summary generated.";

    // 4️⃣ Return both data and summary
    logger.info(`Summary generated for incident ID: ${incidentId}`);

    return {
      incident,
      summary,
    };
  } catch (error) {
    logger.error(
      `Error fetching incident details for ID ${incidentId}: ${error.message}`
    );

    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error.response?.status || 500,
      error.response?.data?.message || "Failed to fetch incident details"
    );
  }
};
