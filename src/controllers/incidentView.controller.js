import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentViewService from "../services/incidentView.service.js";

/**
 * Controller for GET /incident_view/:id
 *
 * Fetches incident details and AI summary for the given incident ID, for the authenticated customer.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Incident details and summary fetched successfully
 * @returns {Object} 204 - No incident details found for this ID/customer
 * @throws {ApiError} 400 - Invalid or missing incident ID, or unauthorized access
 * @throws {ApiError} 429 - Daily AI generation limit reached
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getIncidentDetailsById = catchAsync(async (req, res) => {
  const incidentId = req.params.id;

  if (!incidentId) {
    throw new ApiError(400, "Incident ID is required");
  }

  const response = await incidentViewService.getIncidentDetails(
    incidentId,
    req.customerName,
    req.customeroid,
  );

  // 200 OK if incident details found
  if (response && Object.keys(response).length > 0) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, response, "Incident details fetched successfully")
      );
  }

  // 204 No Content if no incident details found
  return res.status(204).end();
});