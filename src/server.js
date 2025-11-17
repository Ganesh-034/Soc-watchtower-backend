// In your main server file (server.js or app.js)
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { connectReportsDB } from "./services/reportGenerator.service.js";
import logger from "./config/logger.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // Connect to the main database first
    logger.info("🔌 Connecting to main database...");
    await connectDB();
    
    // Then connect to the reports database
    logger.info("🔌 Connecting to reports database...");
    await connectReportsDB();
    
    // Start the server only after both connections are established
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
    
    // Schedule the monthly report generation
    const { scheduleMonthlyReport } = await import("./services/reportGenerator.service.js");
    scheduleMonthlyReport();
    
  } catch (err) {
    logger.error("❌ Server startup failed:", err);
    process.exit(1);
  }
})();