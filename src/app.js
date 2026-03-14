import express from "express";
__CORS_IMPORT__
__COOKIE_PARSER_IMPORT__
__HELMET_IMPORT__
__LOGGER_IMPORT__
__RATE_LIMIT_IMPORT__
import { ApiError } from "#utils/ApiError.js";
import { errorHandler } from "#middlewares/errorHandler.middleware.js";

__AUTH_IMPORT__
import healthcheckRouter from "#routes/healthcheck.routes.js";

const app = express();

__HELMET_SETUP__
__RATE_LIMIT_SETUP__
__LOGGER_SETUP__
__CORS_SETUP__

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
__COOKIE_PARSER_SETUP__

__AUTH_ROUTE__
app.use("/api/v1/healthcheck", healthcheckRouter);

app.use((req, res, next) => {
    next(new ApiError(404, `Route not found: ${req.originalUrl}`));
});

app.use(errorHandler);

export { app };
