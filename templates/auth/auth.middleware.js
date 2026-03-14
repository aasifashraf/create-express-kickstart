import { verifyToken } from "#utils/jwt.util.js";
import { ApiError } from "#utils/ApiError.js";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new ApiError(401, "Authorization header missing."));
  }

  if (!authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authorization header must use the Bearer scheme."));
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(new ApiError(401, "Token missing."));
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded?.id) {
      return next(new ApiError(401, "Token payload is missing a user id."));
    }

    req.user = decoded;
    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token."));
  }
};
