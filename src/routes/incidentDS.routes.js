import express from "express";
import * as incidentDSController from "../controllers/incidentDS.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, attachCustomerInfo);

router.get(
  "/total_incidents_ds",
  incidentDSController.getIncidentsDetectionSource
);

export default router;
