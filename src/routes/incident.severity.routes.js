import express from "express";
import * as incidentController from "../controllers/incident.severity.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

router.get("/incidents_by_severity", incidentController.getIncidentSeverity);
export default router;
