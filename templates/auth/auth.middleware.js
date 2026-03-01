import { verifyToken } from "#utils/jwt.util.js";
import { ApiError } from "#utils/ApiError.js";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new ApiError(401, "Authorization header missing."));
  }
  
  const token = authHeader.split(' ')[1]; // Assuming "Bearer <token>"
  if (!token) {
    return next(new ApiError(401, "Token missing."));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new ApiError(403, "Invalid or expired token."));
  }
};
