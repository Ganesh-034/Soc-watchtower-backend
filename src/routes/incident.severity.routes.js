import express from "express";
import * as incidentController from "../controllers/incident.severity.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

/**
 * GET /incidents_by_severity
 *
 * Returns incident counts by severity for the last three months for the authenticated customer.
 *
 * @header {string} Authorization - Bearer token (required)
 * @query {string} customerName - Name of the customer (attached by middleware)
 *
 * @returns {Object} 200 - Incident severity data fetched successfully
 * @returns {Object} 400 - Invalid or missing customerName
 * @returns {Object} 404 - No incidents found for customer
 * @returns {Object} 500 - Internal Server Error
 */
router.get("/incidents_by_severity", incidentController.getIncidentSeverity);

export default router;