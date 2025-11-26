import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentService from "../services/incident.service.js";

export const getTotalIncidents = catchAsync(async (req, res, next) => {

  const customerName = req.customerName;

  const counts = await incidentService.getTotalIncidents(customerName);

  // 204 No Content when no incidents
  if (!counts.total) {
    return res.status(204).send(); // No response body
  }

  // 200 OK with payload otherwise
  return res
    .status(200)
    .json(new ApiResponse(200, counts, "Incident counts fetched successfully"));
});
