import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.severity.service.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Controller for GET /incidents_by_severity
 *
 * Fetches incident counts by severity for the last three months for the authenticated customer.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {Object} 200 - Incident severity data fetched successfully
 * @throws {ApiError} 400 - Invalid or missing customerName
 * @throws {ApiError} 404 - No incidents found for customer
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getIncidentSeverity = catchAsync(async (req, res) => {
  if (!req.customerName) {
    throw new ApiError(400, "Customer name is required");
  }

  const incidentSeverityData = await incidentService.getIncidentSeverity(req.customerName);

  // 404 Not Found if there are no incidents at all in the last three months
  const totalIncidents =
    incidentSeverityData?.total?.low +
    incidentSeverityData?.total?.medium +
    incidentSeverityData?.total?.high;

  if (!totalIncidents) {
    return res
      .status(404)
      .json(new ApiResponse(404, incidentSeverityData, "No incidents found for this customer in the last three months"));
  }

  // 200 OK with payload otherwise
  return res
    .status(200)
    .json(new ApiResponse(200, incidentSeverityData, "Incident severity data fetched successfully"));
});