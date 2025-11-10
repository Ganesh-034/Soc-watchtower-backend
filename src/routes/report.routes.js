import ejs from "ejs";
import express from "express";
import {
  generateMonthlyReport,
  getReportData,
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

    // Send the rendered HTML
    res.send(html);
  } catch (error) {
    logger.error("Error rendering report:", error);
    res.status(500).send(`Error rendering report: ${error.message}`);
  }
});

export default router;
