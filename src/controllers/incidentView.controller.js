import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentViewService from "../services/incidentView.service.js";

export const getIncidentDetailsById = catchAsync(async (req, res) => {
  const incidentId = req.params.id;

  if (!incidentId) {
    throw new ApiError(400, "Incident ID is required");
  }

  const response = await incidentViewService.getIncidentDetails(
    incidentId,
    req.customerName
  );

  // If we have data, return 200 OK
  if (response && Object.keys(response).length > 0) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, response, "Incident details fetched successfully")
      );
  }

  // use 204 No Content
  return res.status(204).end();
});
