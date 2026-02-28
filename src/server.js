import dotenv from "dotenv";
import { app } from "#app.js";

// Load environment variables from .env file
dotenv.config({
    path: './.env'
});

import connectDB from "#db/index.js";

const PORT = process.env.PORT || 8000;

// Handle uncaught exceptions before starting the server
process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT EXCEPTION! Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});

connectDB()
    .then(() => {
        const server = app.listen(PORT, () => {
            console.log(`Server is running at port : ${PORT}`);
        });

        // Graceful Shutdown
        const gracefulShutdown = (signal) => {
            console.log(`${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log("HTTP server closed.");
                process.exit(0);
            });
            // Force exit if server hasn't closed within 10 seconds
            setTimeout(() => {
                console.error("Could not close connections in time, forcing shutdown.");
                process.exit(1);
            }, 10000).unref();
        };

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });

process.on("unhandledRejection", (err) => {
    console.log("UNHANDLED REJECTION! Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});
