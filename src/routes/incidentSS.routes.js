import express from 'express';
import * as incidentSSController from '../controllers/incidentSS.controller.js';

const router = express.Router();

router.get('/total_incidents_ss', incidentSSController.getIncidentsSubStatus);

export default router;