import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentDSService from "../services/incidentDS.service.js";

export const getIncidentsDetectionSource = catchAsync(async (req, res) => {
  const { month } = req.query;

  // Check if month parameter is missing
  if (!month) {
    throw new ApiError(400, "Missing 'month' query parameter");
  }

  // Validate month format (should be YYYY-MM)
  const monthFormatRegex = /^\d{4}-\d{2}$/;

  if (!monthFormatRegex.test(month)) {
    throw new ApiError(422, "Month parameter must be in YYYY-MM format");
  }

  const incidentDSCounts = await incidentDSService.getIncidentsDetectionSource(
    month,
    req.customerName
  );

  // 204 No Content
  if (
    !incidentDSCounts ||
    !incidentDSCounts.detectionsource ||
    Object.keys(incidentDSCounts.detectionsource).length === 0
  ) {
    return res.status(204).send();
  }

  // 200 Success with data
  return res.json(
    new ApiResponse(
      200,
      incidentDSCounts,
      "Incident counts by Detection source fetched successfully"
    )
  );
});
