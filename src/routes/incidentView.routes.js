import express from 'express';
import * as incidentViewController from '../controllers/incidentView.controller.js';    

const router = express.Router();

// Make sure this path matches exactly what you're trying to call
router.get('/incident_view/:id', incidentViewController.getIncidentDetailsById);

export default router;