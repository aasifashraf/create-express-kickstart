import dotenv from "dotenv";

// Load environment variables BEFORE importing modules that depend on them
dotenv.config({
    path: './.env'
});

const { app } = await import("#app.js");
const { default: connectDB } = await import("#db/index.js");

const PORT = process.env.PORT || 8000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running at port : ${PORT}`);
        });
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });

process.on("unhandledRejection", (err) => {
    console.log("UNHANDLED REJECTION! Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});
