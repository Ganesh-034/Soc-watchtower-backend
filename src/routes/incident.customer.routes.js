import express from "express";
import * as incidentcustomerController from "../controllers/incident.customer.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, attachCustomerInfo);

router.get("/customer_details", incidentcustomerController.getCustomer);
export default router;
