import {
  getHealthEscalationIncidents,
  getNonHealthEscalationIncidents,
} from "../services/incidentTicketReport.service.js";

// Controller for Health incidents with escalation
export const getHealthEscalationIncidentsCtrl = async (req, res) => {
  try {
    const data = await getHealthEscalationIncidents();
    res.status(200).json({
      success: true,
      message: "Fetched health escalation incidents successfully.",
      data,
    });
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch health escalation incidents.",
      error: error.message,
    });
  }
};

// Controller for Non-Health incidents with escalation
export const getNonHealthEscalationIncidentsCtrl = async (req, res) => {
  try {
    const data = await getNonHealthEscalationIncidents();
    res.status(200).json({
      success: true,
      message: "Fetched non-health escalation incidents successfully.",
      data,
    });
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch non-health escalation incidents.",
      error: error.message,
    });
  }
};