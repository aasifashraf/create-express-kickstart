import { ApiError } from '#utils/ApiError.js';

/**
 * Global Error Handler Middleware
 * @param {Error} err
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const errorHandler = (err, req, res, next) => {
    let error = err;

    // If the error is not an instance of ApiError, transform it into one
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode ? error.statusCode : 500;
        const message = error.message || "Internal Server Error";
        
        error = new ApiError(
            statusCode,
            message,
            error?.errors || [], // Pass down any validation errors
            err.stack // Keep the original stack trace
        );
    }

    // Now format the consistent response
    const response = {
        ...error,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    };

    // Send the JSON response
    return res.status(error.statusCode).json(response);
};

export { errorHandler };
