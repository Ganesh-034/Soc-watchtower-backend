import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentHSService from "../services/incidentHS.service.js";

export const getIncidentsHandlingStatus = catchAsync(async (req, res) => {
  const incidentHSCounts = await incidentHSService.getIncidentsHandlingStatus(
    req.customerName
  );
  
  if (!incidentHSCounts || Object.keys(incidentHSCounts).length === 0) {
    return res.status(204).end();
  }
  
  res.json(
    new ApiResponse(
      200,
      incidentHSCounts,
      "Incident counts by Handling Status fetched successfully"
    )
  );
});
