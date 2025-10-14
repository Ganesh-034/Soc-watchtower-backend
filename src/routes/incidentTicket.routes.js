import express from 'express';
import * as incidentTicketController from '../controllers/incidentTicket.controller.js';

const router = express.Router();

router.get('/incident_ticket_table', incidentTicketController.getIncidentTickets);

export default router;