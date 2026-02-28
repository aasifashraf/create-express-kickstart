import { ApiError } from "#utils/ApiError.js";
import { ApiResponse } from "#utils/ApiResponse.js";
import { asyncHandler } from "#utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
    // Basic health check
    return res
        .status(200)
        .json(new ApiResponse(200, { status: "OK", timestamp: Date.now() }, "App is running smoothly"));
});

const triggerError = asyncHandler(async (req, res) => {
    // Dummy route to test the global error handler
    throw new ApiError(400, "This is a custom error thrown for testing purposes.");
});

export { healthcheck, triggerError };
