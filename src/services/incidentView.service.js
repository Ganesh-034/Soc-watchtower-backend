import axios from "axios";
import https from "node:https";
import { ApiError } from "../utils/ApiError.js";
import logger from "../config/logger.js";
import Incident from "../models/incident.model.js";
import UserCount from "../models/incident.model.view.js";  

export const getIncidentDetails = async (incidentId, customerName, customeroid) => {
  try {
    if (!incidentId || !customerName || !customeroid) {
      throw new Error(
        "IncidentId, customerName, and customeroid are required for fetching incident details."
      );
    }

    // Check daily usage limit
    const today = new Date().toISOString().slice(0, 10);
    
    const userCountDoc = await UserCount.findOneAndUpdate(
      { userOid: customeroid, date: today },
      {
        $inc: { count: 1 },
        $setOnInsert: { createdAt: new Date().toISOString() },
        $set: { updatedAt: new Date().toISOString() }
      },
      { upsert: true, new: true } // Return the updated document
    );
    
    // Check if user has exceeded daily limit
    if (userCountDoc.count > 5) {
      
      await UserCount.updateOne(
        { userOid: customeroid, date: today },
        { $inc: { count: -1 } }
      );
      
      logger.warn(`User ${customeroid} has reached their daily AI generation limit of 5 requests`);
      throw new ApiError(429, "Daily limit reached: Only 5 AI generations allowed per day");
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
        400,
        "Incident not found or you do not have permission to view it "
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
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT; 
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_ID; 
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
      aiResponse.data.choices?.[0]?.message?.content || "No summary generated.";

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