<<<<<<< Updated upstream
export const connectDB = async () => {
  console.log("ℹ️ Database connection skipped (MongoDB not configured yet).");
=======
// export const connectDB = async () => {
//   console.log("ℹ️ Database connection skipped (MongoDB not configured yet).");
// };

// config/db.js
import mongoose from "mongoose";
import logger from "./logger.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.MONGODB_DB_NAME, // Explicitly set the database name
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
>>>>>>> Stashed changes
};
