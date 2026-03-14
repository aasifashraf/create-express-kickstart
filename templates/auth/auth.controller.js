import User from "#models/user.model.js";
import { ApiError } from "#utils/ApiError.js";
import { asyncHandler } from "#utils/asyncHandler.js";
import { ApiResponse } from "#utils/ApiResponse.js";
import { generateToken } from "#utils/jwt.util.js";
import { hashData, compareData } from "#utils/hash.util.js";

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const authController = {
  register: asyncHandler(async (req, res) => {
    const { name, email, password } = req.body ?? {};

    if (!name?.trim() || !email?.trim() || !password) {
      throw new ApiError(400, "Name, email, and password are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      throw new ApiError(409, "A user with that email already exists.");
    }

    const hashedPassword = await hashData(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        { token, user: sanitizeUser(user) },
        "Registration successful",
      ),
    );
  }),

  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email?.trim() || !password) {
      throw new ApiError(400, "Email and password are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const passwordMatches = await compareData(password, user.password);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
    });

    return res.status(200).json(
      new ApiResponse(200, { token, user: sanitizeUser(user) }, "Login successful"),
    );
  }),

  profile: asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?.id).select("-password");

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { user },
        "Protected profile data retrieved successfully.",
      ),
    );
  }),
};
