import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.severity.service.js";
import { ApiError } from "../utils/ApiError.js"; // Assuming you have this import

export const getIncidentSeverity = catchAsync(async (req, res) => {
  // Check if customer name is provided
  if (!req.customerName) {
    throw new ApiError(400, "Customer name is required");
  }

  const incidentSeverityData = await incidentService.getIncidentSeverity(
    req.customerName
  );
  
  // Return success with data (even if the data shows zero incidents)
  return res.status(200).json(
    new ApiResponse(
      200,
      incidentSeverityData,
      "Incident severity data fetched successfully"
    )
  );
});
