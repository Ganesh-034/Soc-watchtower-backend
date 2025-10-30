import express from "express";
import * as incidentTicketController from "../controllers/incidentTicket.controller.js";
import { authenticate, attachCustomerInfo } from "../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, attachCustomerInfo);

router.get(
  "/incident_ticket_table",
  incidentTicketController.getIncidentTickets
);

export default router;
