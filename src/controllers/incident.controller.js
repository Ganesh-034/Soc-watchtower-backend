import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.service.js";

export const getTotalIncidents = catchAsync(async (req, res) => {
  const incidentCounts = await incidentService.getTotalIncidents(
    req.customerName
  );
  res.json(
    new ApiResponse(200, incidentCounts, "Incident counts fetched successfully")
  );
});
