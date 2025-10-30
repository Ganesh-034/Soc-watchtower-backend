import express from "express";
import * as incidentController from "../controllers/incident.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

router.get("/total_incidents", incidentController.getTotalIncidents);
export default router;
