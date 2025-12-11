// In routes/reportDownload.routes.js
import express from "express";
import {
  getReportSasUrl,
  getAvailableReportsForCustomer,
  debugReports,
  //enhancedDebugReports,
  clearTestReports,
  createTestReport,
  createMultipleTestReports,
  getDirectSasUrl,
  // createManualTestReport,
  //   advancedDatabaseDebug,
  // directQueryReports,
  // testCollectionNames,
} from "../services/reportDownload.service.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticate);
router.use(attachCustomerInfo);

// Main routes
router.get("/sas-url/:month/:year", getReportSasUrl);
router.get("/customer", getAvailableReportsForCustomer);
//router.get('/debug/enhanced', enhancedDebugReports);
// Debug and test routes
router.get("/direct-sas/:month/:year", getDirectSasUrl);
router.get("/debug", debugReports);
router.get("/clear-test-reports", clearTestReports);
router.get("/create-test-report", createTestReport);

router.get("/create-multiple-test-reports", createMultipleTestReports);

export default router;
