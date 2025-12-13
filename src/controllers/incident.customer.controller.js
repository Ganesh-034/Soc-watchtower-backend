import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentcustomerService from "../services/incident.customer.service.js";

/**
 * Controller for GET /customer_details
 *
 * Handles the request to fetch customer details.
 *
 * Extracts `customerName` from the request, calls the service to retrieve customer info,
 * and returns the result in a standardized API response.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {Object} 200 - Customer details fetched successfully
 * @throws {ApiError} 400 - Invalid or missing customerName
 * @throws {ApiError} 404 - Customer not found
 * @throws {ApiError} 500 - Internal Server Error
 */
export const getCustomer = catchAsync(async (req, res, next) => {
  
  const customerName = req.customerName;

  const customerInfo = await incidentcustomerService.getCustomer(customerName);

  // Return the customer info
  return res
    .status(200)
    .json(new ApiResponse(200, customerInfo, "Customer details fetched successfully"));
});