import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import logger from "./config/logger.js";
import { scheduleMonthlyReport } from "./services/reportGenerator.service.js" // Add this line

dotenv.config();

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    
    // Schedule monthly report generation
    scheduleMonthlyReport(); // Add this line
    
    app.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    logger.error("Server startup failed:", err);
    process.exit(1);
  }
})();