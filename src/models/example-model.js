//example-model.js
import mongoose from "mongoose";

const exampleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
    },
    age: {
        type: Number,
        required: [true, "Age is required"],
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
    },
});