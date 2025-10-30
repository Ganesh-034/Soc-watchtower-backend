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

    const username = "Soc-Watchtower";
    const password = "123";
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const instance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    const response = await instance.post(
      "https://n8n-a-etgmh6bka9h4hkbw.southeastasia-01.azurewebsites.net/webhook/8bee028f-2f13-465d-998a-e5ba3397c650", // The URL for the external API call
      incidentId,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      }
    );

    logger.info(
      `Incident details fetched for ID: ${incidentId} for customer: ${customerName}`
    );
    return response.data;
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
