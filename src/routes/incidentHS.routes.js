import express from "express";
import * as incidentHSController from "../controllers/incidentHS.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

/**
 * GET /total_incidents_hs
 *
 * Returns incident counts by handling status for the last three months for the authenticated customer.
 *
 * @header {string} Authorization - Bearer token (required)
 * @header {string} x-api-key - API key (required)
 * @query {string} customerName - Name of the customer (attached by middleware)
 *
 * @returns {Object} 200 - Incident counts by handling status fetched successfully
 * @returns {Object} 400 - Missing required parameters
 * @returns {Object} 500 - Internal Server Error
 */
router.get(
  "/total_incidents_hs",
  incidentHSController.getIncidentsHandlingStatus
);

export default router;