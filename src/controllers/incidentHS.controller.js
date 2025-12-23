import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentHSService from "../services/incidentHS.service.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Controller for GET /total_incidents_hs
 *
 * Fetches incident counts by handling status for the last three months for the authenticated customer.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {Object} 200 - Incident counts by handling status fetched successfully
 * @throws {ApiError} 400 - Missing customerName
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getIncidentsHandlingStatus = catchAsync(async (req, res) => {
  // 400 if customerName is missing (middleware should attach it)
  if (!req.customerName) {
    throw new ApiError(400, "Customer name is required");
  }

  const incidentHSCounts = await incidentHSService.getIncidentsHandlingStatus(
    req.customerName
  );

  // 200 Success with data
  return res.json(
    new ApiResponse(
      200,
      incidentHSCounts,
      "Incident counts by Handling Status fetched successfully"
    )
  );
});