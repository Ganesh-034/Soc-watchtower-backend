import express from "express";
import * as incidentcustomerController from "../controllers/incident.customer.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);
/**
 * GET /customer_details
 *
 * Retrieve customer details by customer name.
 *
 * Allows clients to fetch display name and image for a specific customer, based on the `customerName` field.
 *
 * @header {string} Authorization - Bearer token (required)
 * @header {string} content-type - Request content type, typically application/json (optional)
 * @header {string} x-api-key - API key for authentication (required)
 *
 * @query {string} customerName - Name of the customer to fetch details for (required)
 *
 * @returns {Object} 200 - Customer details fetched successfully
 * @returns {Object} 400 - Invalid or missing customerName
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 403 - Forbidden
 * @returns {Object} 404 - Customer not found
 * @returns {Object} 415 - Unsupported Media Type
 * @returns {Object} 500 - Internal Server Error
 */
router.get("/customer_details", incidentcustomerController.getCustomer);
export default router;
