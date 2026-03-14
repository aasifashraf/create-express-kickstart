import { app } from "#app.js";
__DB_IMPORT__

const PORT = Number(process.env.PORT) || 8000;

const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

__SERVER_STARTUP__

process.on("unhandledRejection", (error) => {
    console.error("UNHANDLED REJECTION! Shutting down...");
    console.error(error.name, error.message);
    process.exit(1);
});
