import express from 'express';
import * as incidentDSController from '../controllers/incidentDS.controller.js';

const router = express.Router();

router.get('/total_incidents_ds', incidentDSController.getIncidentsDetectionSource);

export default router;