import ejs from "ejs";
import express from "express";
import {
  generateMonthlyReport,
  getReportData,
  checkReportsDBHealth, // Add this import
} from "../services/reportGenerator.service.js";
import path from "path";
import logger from "../config/logger.js";

const router = express.Router();

router.get("/generate-report", async (req, res) => {
  try {
    const pdfPath = await generateMonthlyReport();
    res.send(`Report generated successfully: ${pdfPath}`);
  } catch (error) {
    logger.error("Error generating report:", error);
    res.status(500).send(`Error generating report: ${error.message}`);
  }
});

router.get("/view-report", async (req, res) => {
  try {
    const data = await getReportData();

    const html = await ejs.renderFile(
      path.join(process.cwd(), "src","templates", "reportTemplate.ejs"),
      data
    );

    // Send's rendered HTML
    res.send(html);
  } catch (error) {
    logger.error("Error rendering report:", error);
    res.status(500).send(`Error rendering report: ${error.message}`);
  }
});

// Add health check endpoint
router.get("/health", async (req, res) => {
  try {
    const health = await checkReportsDBHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: `Reports database health check error: ${error.message}`
    });
  }
});


// Add to your report router file
router.get("/verify-db", async (req, res) => {
  try {
    const context = await verifyDatabaseContext();
    res.json({
      success: true,
      context
    });
  } catch (error) {
    logger.error("Error verifying database context:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
export default router;