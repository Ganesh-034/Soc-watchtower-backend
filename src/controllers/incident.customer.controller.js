import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentcustomerService from "../services/incident.customer.service.js";

export const getCustomer = catchAsync(async (req, res, next) => {
  
  const customerName = req.customerName;

  const customerInfo = await incidentcustomerService.getCustomer(customerName);

  // Return the customer info
  return res
    .status(200)
    .json(new ApiResponse(200, customerInfo, "Customer details fetched successfully"));
});