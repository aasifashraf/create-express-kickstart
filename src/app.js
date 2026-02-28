import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { errorHandler } from "#middlewares/errorHandler.middleware.js";

// Import routers
import healthcheckRouter from "#routes/healthcheck.routes.js";

const app = express();

// Security HTTP headers
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // Default 15 minutes
    limit: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: "Too many requests from this IP, please try again later"
});
app.use("/api", limiter); // Apply rate limiting to all API routes

// Logging
app.use(pinoHttp({
    customLogLevel: function (req, res, err) {
        if (res.statusCode >= 400 && res.statusCode < 500) {
            return 'warn'
        } else if (res.statusCode >= 500 || err) {
            return 'error'
        } else if (res.statusCode >= 300 && res.statusCode < 400) {
            return 'silent'
        }
        return 'info'
    },
    // Dynamically require pino-pretty if in dev and it exists, else undefined
    transport: process.env.NODE_ENV === "development" ? (function() {
        try {
            import("pino-pretty");
            return {
                target: 'pino-pretty',
                options: { colorize: true }
            };
        } catch (e) {
            return undefined;
        }
    })() : undefined
}));

// CORS setup
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "*", // Fallback to allowing everything
        credentials: true, // Allow cookies with requests
    })
);

// Payload sizes and forms
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); 
app.use(cookieParser());

// -------- API ROUTES ---------
// Mount routers
app.use("/api/v1/healthcheck", healthcheckRouter);

// Global Error Handler
// Always add this as the very last middleware
app.use(errorHandler);

export { app };
