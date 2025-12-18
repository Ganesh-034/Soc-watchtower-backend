import express from "express";
import * as incidentViewController from "../controllers/incidentView.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

/**
 * GET /incident_view/:id
 *
 * Returns incident details and AI summary for the given incident ID, for the authenticated customer.
 *
 * @header {string} Authorization - Bearer token (required)
 * @param {string} id - Incident ID (required, in URL path)
 * @returns {Object} 200 - Incident details and summary fetched successfully
 * @returns {Object} 204 - No incident details found for this ID/customer
 * @returns {Object} 400 - Invalid or missing incident ID, or unauthorized access
 * @returns {Object} 429 - Daily AI generation limit reached
 * @returns {Object} 500 - Internal Server Error
 */
router.get("/incident_view/:id", incidentViewController.getIncidentDetailsById);

export default router;