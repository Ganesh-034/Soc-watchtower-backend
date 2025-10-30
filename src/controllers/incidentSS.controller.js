import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentSSService from "../services/incidentSS.service.js";

export const getIncidentsSubStatus = catchAsync(async (req, res) => {
  const { month } = req.query;

  if (!month) {
    throw new ApiError(400, "Missing 'month' query parameter");
  }

  const incidentSSCounts = await incidentSSService.getIncidentsSubStatus(
    month,
    req.customerName
  );
  res.json(
    new ApiResponse(
      200,
      incidentSSCounts,
      "Incident counts by Sub Status fetched successfully"
    )
  );
});
