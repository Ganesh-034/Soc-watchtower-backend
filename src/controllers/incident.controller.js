import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import * as incidentService from '../services/incident.service.js';

export const getTotalIncidents = catchAsync(async (req, res) => {
  const totalIncidents = await incidentService.getTotalIncidents();
  res.json(new ApiResponse(200, { count: totalIncidents }, "Total incidents fetched successfully"));
});