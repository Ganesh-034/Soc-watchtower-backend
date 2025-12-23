import express from "express";
import * as incidentTicketReportController from "../controllers/incidentTicketReport.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

/**
 * GET /health-escalation
 * 
 * Returns all 'Health Incident' tickets with customer escalation for November 2025.
 * 
 * @header {string} Authorization - Bearer token (required)
 * @returns {Object} 200 - Fetched health escalation incidents successfully
 * @returns {Object} 404 - No health escalation incidents found
 * @returns {Object} 500 - Internal Server Error
 */
router.get(
  "/health-escalation",
  incidentTicketReportController.getHealthEscalationIncidentsCtrl
);

/**
 * GET /non-health-escalation
 * 
 * Returns all non-'Health Incident' tickets with customer escalation for November 2025.
 * 
 * @header {string} Authorization - Bearer token (required)
 * @returns {Object} 200 - Fetched non-health escalation incidents successfully
 * @returns {Object} 404 - No non-health escalation incidents found
 * @returns {Object} 500 - Internal Server Error
 */
router.get(
  "/non-health-escalation",
  incidentTicketReportController.getNonHealthEscalationIncidentsCtrl
);

export default router;