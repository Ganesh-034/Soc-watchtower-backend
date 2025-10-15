import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import * as incidentHSService from '../services/incidentHS.service.js';

export const getIncidentsHandlingStatus = catchAsync(async (req, res) => {
  const { month } = req.query;
  
  // Month validation removed
  
  const incidentHSCounts = await incidentHSService.getIncidentsHandlingStatus(month);
  res.json(new ApiResponse(200, incidentHSCounts, "Incident counts by Handling Status fetched successfully"));
});