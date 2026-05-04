import express from "express";
import * as incidentTicketController from "../controllers/incidentTicket.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, attachCustomerInfo);

/**
 * GET /incident_ticket_table
 *
 * Returns paginated incident tickets for the authenticated customer, with filtering and date range support.
 *
 * @header {string} Authorization - Bearer token (required)
 * @query {number} page - Page number (default: 0)
 * @query {number} limit - Page size (default: 10)
 * @query {string} filters - JSON string of filter objects
 * @query {string} startDate - Start date for filtering (optional)
 * @query {string} endDate - End date for filtering (optional)
 *
 * @returns {Object} 200 - Incident tickets fetched successfully
 * @returns {null} 204 - No tickets found
 * @returns {Object} 400 - Invalid filter format or missing customer info
 * @returns {Object} 500 - Internal Server Error
 */
router.get(
  "/incident_ticket_table",
  incidentTicketController.getIncidentTickets
);

router.get('/incident_ticket_table/export', incidentTicketController.exportIncidentTicketsExcel);

export default router;