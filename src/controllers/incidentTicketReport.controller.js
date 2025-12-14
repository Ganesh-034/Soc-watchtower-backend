import {
  getHealthEscalationIncidents,
  getNonHealthEscalationIncidents,
} from "../services/incidentTicketReport.service.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Controller for GET /health-escalation
 * 
 * @returns {Object} 200 - Fetched health escalation incidents successfully
 * @returns {Object} 404 - No health escalation incidents found
 * @returns {Object} 500 - Internal Server Error
 */
export const getHealthEscalationIncidentsCtrl = async (req, res) => {
  try {
    const data = await getHealthEscalationIncidents();

    if (!data.tickets || data.tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No health escalation incidents found for November 2025.",
        data,
      });
    }

    res.status(200).json({
      success: true,
      message: "Fetched health escalation incidents successfully.",
      data,
    });
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch health escalation incidents.",
    });
  }
};

/**
 * Controller for GET /non-health-escalation
 * 
 * @returns {Object} 200 - Fetched non-health escalation incidents successfully
 * @returns {Object} 404 - No non-health escalation incidents found
 * @returns {Object} 500 - Internal Server Error
 */
export const getNonHealthEscalationIncidentsCtrl = async (req, res) => {
  try {
    const data = await getNonHealthEscalationIncidents();

    if (!data.tickets || data.tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No non-health escalation incidents found for November 2025.",
        data,
      });
    }

    res.status(200).json({
      success: true,
      message: "Fetched non-health escalation incidents successfully.",
      data,
    });
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch non-health escalation incidents.",
    });
  }
};