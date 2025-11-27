import express from "express";
import * as incidentTicketReportController from "../controllers/incidentTicketReport.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, attachCustomerInfo);

router.get(
  "/health-escalation",
  incidentTicketReportController.getHealthEscalationIncidentsCtrl
);

/**
 * @route   GET /api/incidents/non-health-escalation
 * @desc    Get all non-'Health' incident types with 'Yes' customer escalation for October 2025
 */
router.get(
  "/non-health-escalation",
  incidentTicketReportController.getNonHealthEscalationIncidentsCtrl
);

export default router;
