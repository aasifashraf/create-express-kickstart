import { asyncHandler } from "#utils/asyncHandler.js";
import { ApiResponse } from "#utils/ApiResponse.js";
import { generateToken } from "#utils/jwt.util.js";
import { hashData, compareData } from "#utils/hash.util.js";

export const authController = {
  login: asyncHandler(async (req, res) => {
    // In a real app, you would fetch user from database and compare passwords here
    // Example: const isMatch = await compareData(req.body.password, user.password);
    
    // For now, let's just generate a mock token
    const token = generateToken({ id: 1, role: "user" });
    
    return res.status(200).json(
      new ApiResponse(200, { token }, "Login successful")
    );
  }),
  
  register: asyncHandler(async (req, res) => {
    // Example: const hashedPassword = await hashData(req.body.password);
    return res.status(201).json(
      new ApiResponse(201, {}, "Register logic goes here")
    );
  }),
  
  profile: asyncHandler(async (req, res) => {
    return res.status(200).json(
      new ApiResponse(200, { user: req.user }, "Protected profile data retrieved successfully.")
    );
  })
};
