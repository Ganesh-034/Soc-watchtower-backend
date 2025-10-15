import axios from 'axios';
import https from 'https';
import { ApiError } from '../utils/ApiError.js';
import logger from '../config/logger.js';

export const getIncidentDetails = async (incidentId) => {
  try {
    const username = "Soc-Watchtower";
    const password = "123";
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    
    // Create a custom Axios instance with SSL verification disabled
    const instance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    const response = await instance.post(
      "https://n8n-a-etgmh6bka9h4hkbw.southeastasia-01.azurewebsites.net/webhook/8bee028f-2f13-465d-998a-e5ba3397c650",
      incidentId,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`,
        },
      }
    );
    
    logger.info(`Incident details fetched for ID: ${incidentId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching incident details for ID ${incidentId}: ${error.message}`);
    
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    throw new ApiError(
      error.response?.status || 500,
      error.response?.data?.message || "Failed to fetch incident details"
    );
  }
};