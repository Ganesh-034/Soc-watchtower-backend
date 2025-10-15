import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import * as incidentViewService from '../services/incidentView.service.js';

export const getIncidentDetailsById = catchAsync(async (req, res) => {
  const incidentId = req.params.id;

  if (!incidentId) {
    throw new ApiError(400, "Incident ID is required");
  }

  const response = await incidentViewService.getIncidentDetails(incidentId);
  return res
    .status(200)
    .json(new ApiResponse(200, response, "Incident details fetched successfully"));
});