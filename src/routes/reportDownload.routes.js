// In routes/reportDownload.routes.js
import express from 'express';
import { 
  getReportSasUrl, 
  getAvailableReportsForCustomer,
  debugReports,
  clearTestReports,
  createTestReport,
  createMultipleTestReports
} from '../services/reportDownload.service.js';
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticate);
router.use(attachCustomerInfo);

// Main routes
router.get('/sas-url/:month/:year', getReportSasUrl);
router.get('/customer', getAvailableReportsForCustomer);

// Debug and test routes
router.get('/debug', debugReports);
router.get('/clear-test-reports', clearTestReports);
router.get('/create-test-report', createTestReport);
router.get('/create-multiple-test-reports', createMultipleTestReports);

export default router;