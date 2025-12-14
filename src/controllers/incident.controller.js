import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.service.js";

/**
 * Controller for GET /total_incidents
 *
 * Fetches incident counts for the current month for the authenticated customer.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {Object} 200 - Incident counts fetched successfully
 * @throws {ApiError} 400 - Invalid or missing customerName
 * @throws {ApiError} 404 - No incidents found for customer
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getTotalIncidents = catchAsync(async (req, res, next) => {
  const customerName = req.customerName;

  const counts = await incidentService.getTotalIncidents(customerName);

  // 404 Not Found if no incidents for customer
  if (counts.total === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No incidents found for this customer in the current month"));
  }

  // 200 OK with payload otherwise
  return res
    .status(200)
    .json(new ApiResponse(200, counts, "Incident counts fetched successfully"));
});