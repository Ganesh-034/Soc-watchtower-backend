import express from "express";
import * as incidentDSController from "../controllers/incidentDS.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

/**
 * GET /total_incidents_ds
 *
 * Returns incident counts by detection source for a given month and customer.
 *
 * @header {string} Authorization - Bearer token (required)
 * @header {string} x-api-key - API key (required)
 * @query {string} month - Month in YYYY-MM format (required)
 * @query {string} customerName - Name of the customer (attached by middleware)
 *
 * @returns {Object} 200 - Incident counts by detection source fetched successfully
 * @returns {Object} 400 - Missing required parameters
 * @returns {Object} 422 - Invalid month format
 * @returns {Object} 500 - Internal Server Error
 */
router.get(
  "/total_incidents_ds",
  incidentDSController.getIncidentsDetectionSource
);

export default router;