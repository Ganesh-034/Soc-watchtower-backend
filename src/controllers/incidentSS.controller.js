import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import * as incidentSSService from "../services/incidentSS.service.js";

export const getIncidentsSubStatus = catchAsync(async (req, res) => {
  const { month } = req.query;

  // 400 Bad Request
  if (!month) {
    throw new ApiError(400, "Missing 'month' query parameter");
  }

  // 422 Unprocessable Entity - Invalid format
  const monthFormatRegex = /^\d{4}-\d{2}$/;
  if (!monthFormatRegex.test(month)) {
    throw new ApiError(422, "Month parameter must be in YYYY-MM format");
  }

  const incidentSSCounts = await incidentSSService.getIncidentsSubStatus(
    month,
    req.customerName
  );

  // 204 No Content
  if (
    !incidentSSCounts ||
    !incidentSSCounts.substatus ||
    incidentSSCounts.substatus.length === 0
  ) {
    return res.status(204).send();
  }

  // 200 Success with data
  return res.json(
    new ApiResponse(
      200,
      incidentSSCounts,
      "Incident counts by Sub Status fetched successfully"
    )
  );
});
