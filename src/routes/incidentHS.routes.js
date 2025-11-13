import express from "express";
import * as incidentHSController from "../controllers/incidentHS.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);


router.get(
  "/total_incidents_hs",
  incidentHSController.getIncidentsHandlingStatus
);

export default router;
