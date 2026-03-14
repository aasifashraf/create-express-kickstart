import mongoose from "mongoose";

const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI must be set before connecting to MongoDB.");
    }

    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected. Host: ${connectionInstance.connection.host}`);
};

export default connectDB;
