import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentDSService from "../services/incidentDS.service.js";

/**
 * Controller for GET /total_incidents_ds
 *
 * Fetches incident counts by detection source for a given month and customer.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {Object} 200 - Incident counts by detection source fetched successfully
 * @throws {ApiError} 400 - Missing required parameters
 * @throws {ApiError} 422 - Invalid month format
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getIncidentsDetectionSource = catchAsync(async (req, res) => {
  const { month } = req.query;

  // 400 if month is missing
  if (!month) {
    throw new ApiError(400, "Missing 'month' query parameter");
  }

  // 422 if month format is invalid
  const monthFormatRegex = /^\d{4}-\d{2}$/;
  if (!monthFormatRegex.test(month)) {
    throw new ApiError(422, "Month parameter must be in YYYY-MM format");
  }

  // 400 if customerName is missing (middleware should attach it)
  if (!req.customerName) {
    throw new ApiError(400, "Missing customer name");
  }

  const incidentDSCounts = await incidentDSService.getIncidentsDetectionSource(
    month,
    req.customerName
  );

  // 200 Success with data
  return res.json(
    new ApiResponse(
      200,
      incidentDSCounts,
      "Incident counts by Detection source fetched successfully"
    )
  );
});