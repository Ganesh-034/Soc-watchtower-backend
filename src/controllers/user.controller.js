import { getAllUsers } from "../services/user.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";

export const getUsers = catchAsync(async (req, res) => {
  const users = await getAllUsers();
  return res.status(200).json(new ApiResponse(200, users, "Users fetched"));
});
