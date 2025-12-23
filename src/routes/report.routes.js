import ejs from "ejs";
import express from "express";
import {
  generateMonthlyReport,
  getReportData,
  checkReportsDBHealth,
  generateLast5MonthsReports,
} from "../services/reportGenerator.service.js";
import path from "node:path";
import logger from "../config/logger.js";

const router = express.Router();

// Health check endpoint
// router.get("/health", async (req, res) => {
//   try {
//     const health = await checkReportsDBHealth();
//     const statusCode = health.status === "healthy" ? 200 : 503;
//     res.status(statusCode).json(health);
//   } catch (error) {
//     res.status(503).json({
//       status: "unhealthy",
//       message: `Reports database health check error: ${error.message}`,
//     });
//   }
// });

// Generate a single monthly report
router.get("/generate-report", async (req, res) => {
  try {
    const pdfPath = await generateMonthlyReport();
    res.send(`Report generated successfully: ${pdfPath}`);
  } catch (error) {
    logger.error("Error generating report:", error);
    res.status(500).send(`Error generating report: ${error.message}`);
  }
});

// View report as HTML in browser
// router.get("/view-report", async (req, res) => {
//   try {
//     const data = await getReportData();

//     const html = await ejs.renderFile(
//       path.join(process.cwd(), "src", "templates", "reportTemplate.ejs"),
//       data
//     );

//     // Send rendered HTML
//     res.send(html);
//   } catch (error) {
//     logger.error("Error rendering report:", error);
//     res.status(500).send(`Error rendering report: ${error.message}`);
//   }
// });

// // Generate reports for the last 5 months
// router.post("/generate/last5months", async (req, res) => {
//   try {
//     const results = await generateLast5MonthsReports();
//     res.json({
//       message: "Last 5 months report generation completed",
//       results,
//     });
//   } catch (error) {
//     logger.error("Error generating last 5 months reports:", error);
//     res.status(500).json({ error: "Failed to generate last 5 months reports" });
//   }
// });

export default router;
