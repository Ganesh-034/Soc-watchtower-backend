import express from 'express';
import * as incidentHSController from '../controllers/incidentHS.controller.js';

const router = express.Router();

router.get('/total_incidents_hs', incidentHSController.getIncidentsHandlingStatus);

export default router;