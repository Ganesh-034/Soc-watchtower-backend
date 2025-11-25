import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.severity.service.js";

export const getIncidentSeverity = catchAsync(async (req, res) => {
  const incidentSeverityData = await incidentService.getIncidentSeverity(
    req.customerName
  );
  res.json(
    new ApiResponse(
      200,
      incidentSeverityData,
      "Incident severity data fetched successfully"
    )
  );
});
