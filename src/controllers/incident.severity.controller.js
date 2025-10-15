import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import * as incidentService from '../services/incident.severity.service.js';

export const getIncidentSeverity = catchAsync(async (req, res) => {
  const incidentCounts = await incidentService.getIncidentSeverity();
  res.json(new ApiResponse(200, incidentCounts, "Incidents fetched sucessfully"));
});