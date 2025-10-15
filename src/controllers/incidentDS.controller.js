// import { ApiResponse } from '../utils/ApiResponse.js';
// import { ApiError } from '../utils/ApiError.js';
// import catchAsync from '../utils/catchAsync.js';
// import * as incidentService from '../services/incident.service.js';

// export const getTotalIncidents = catchAsync(async (req, res) => {
//   const totalIncidents = await incidentService.getTotalIncidents();
//   res.json(new ApiResponse(200, { count: totalIncidents }, "Total incidents fetched successfully"));
// });








import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import * as incidentDSService from '../services/incidentDS.service.js';

export const getIncidentsDetectionSource = catchAsync(async (req, res) => {
  const { month } = req.query;


  if (!month) {
    throw new ApiError(400, "Missing 'month' query parameter");
  }

  const incidentDSCounts = await incidentDSService.getIncidentsDetectionSource(month);
  res.json(new ApiResponse(200, incidentDSCounts, "Incident counts by Detection source fetched successfully"));
});