import express from "express";
import * as incidentViewController from "../controllers/incidentView.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, attachCustomerInfo);
router.get("/incident_view/:id", incidentViewController.getIncidentDetailsById);

export default router;
