import express from 'express';
import * as incidentController from '../controllers/incident.severity.controller.js';

const router = express.Router();

router.get('/incidents_by_severity', incidentController.getIncidentSeverity);

export default router;