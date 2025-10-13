import express from 'express';
import * as incidentController from '../controllers/incident.controller.js';

const router = express.Router();

router.get('/total_incidents', incidentController.getTotalIncidents);

export default router;