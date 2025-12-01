import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.severity.service.js";

export const getIncidentSeverity = catchAsync(async (req, res) => {
  // Check if customer name is provided
  if (!req.customerName) {
    throw new ApiError(400, "Customer name is required");
  }

  const incidentSeverityData = await incidentService.getIncidentSeverity(
    req.customerName
  );

  // Check if we have any data
  if (
    !incidentSeverityData ||
    Object.values(incidentSeverityData.total).reduce(
      (sum, val) => sum + val,
      0
    ) === 0
  ) {
    return res
      .status(204)
      .json(
        new ApiResponse(
          204,
          null,
          "No incident severity data found for this customer"
        )
      );
  }

  // Return success with data
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        incidentSeverityData,
        "Incident severity data fetched successfully"
      )
    );
});
