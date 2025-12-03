
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../services/incidentTicketReport.service.js', () => ({
  getHealthEscalationIncidents: jest.fn(),
  getNonHealthEscalationIncidents: jest.fn(),
}));

const reportService = await import('../../services/incidentTicketReport.service.js');
const {
  getHealthEscalationIncidentsCtrl,
  getNonHealthEscalationIncidentsCtrl,
} = await import('../../controllers/incidentTicketReport.controller.js');

const app = express();
app.get('/health-escalation', getHealthEscalationIncidentsCtrl);
app.get('/non-health-escalation', getNonHealthEscalationIncidentsCtrl);

describe('Incident Ticket Report Controllers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should return 200 for health escalation incidents', async () => {
    reportService.getHealthEscalationIncidents.mockResolvedValue([{ id: 1 }]);
    const response = await request(app).get('/health-escalation');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should return 500 on health escalation service error', async () => {
    reportService.getHealthEscalationIncidents.mockRejectedValue(new Error('Service failure'));
    const response = await request(app).get('/health-escalation');
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });

  test('should return 200 for non-health escalation incidents', async () => {
    reportService.getNonHealthEscalationIncidents.mockResolvedValue([{ id: 2 }]);
    const response = await request(app).get('/non-health-escalation');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should return 500 on non-health escalation service error', async () => {
    reportService.getNonHealthEscalationIncidents.mockRejectedValue(new Error('Service failure'));
    const response = await request(app).get('/non-health-escalation');
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});
