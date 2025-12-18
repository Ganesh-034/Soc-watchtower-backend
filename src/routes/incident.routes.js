import express from "express";
import * as incidentController from "../controllers/incident.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

/**
 * GET /total_incidents
 *
 * Returns total, open, and closed incident counts for the current month for the authenticated customer.
 *
 * @header {string} Authorization - Bearer token (required)
 * @query {string} customerName - Name of the customer (attached by middleware)
 *
 * @returns {Object} 200 - Incident counts fetched successfully
 * @returns {Object} 400 - Invalid or missing customerName
 * @returns {Object} 404 - No incidents found for customer
 * @returns {Object} 500 - Internal Server Error
 */
router.get("/total_incidents", incidentController.getTotalIncidents);

export default router;