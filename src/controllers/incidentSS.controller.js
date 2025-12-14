import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentSSService from "../services/incidentSS.service.js";

/**
 * Controller for GET /total_incidents_ss
 *
 * Fetches incident counts by sub-status for a given month and customer.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {Object} 200 - Incident counts by sub-status fetched successfully
 * @throws {ApiError} 400 - Missing required parameters
 * @throws {ApiError} 422 - Invalid month format
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getIncidentsSubStatus = catchAsync(async (req, res) => {
  const { month } = req.query;

  // 400 Bad Request if month is missing
  if (!month) {
    throw new ApiError(400, "Missing 'month' query parameter");
  }

  // 422 Unprocessable Entity - Invalid format
  const monthFormatRegex = /^\d{4}-\d{2}$/;
  if (!monthFormatRegex.test(month)) {
    throw new ApiError(422, "Month parameter must be in YYYY-MM format");
  }

  // 400 if customerName is missing (middleware should attach it)
  if (!req.customerName) {
    throw new ApiError(400, "Missing customer name");
  }

  const incidentSSCounts = await incidentSSService.getIncidentsSubStatus(
    month,
    req.customerName
  );

  // 200 Success with data
  return res.json(
    new ApiResponse(
      200,
      incidentSSCounts,
      "Incident counts by Sub Status fetched successfully"
    )
  );
});