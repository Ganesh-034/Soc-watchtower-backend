
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ✅ Mock service module
jest.unstable_mockModule('../../services/incident.severity.service.js', () => ({
  getIncidentSeverity: jest.fn(),
}));

const incidentService = await import('../../services/incident.severity.service.js');
const { getIncidentSeverity } = await import('../../controllers/incident.severity.controller.js');

const app = express();
app.use(express.json());
app.get('/incident-severity', (req, res, next) => {
  req.customerName = 'ACME';
  getIncidentSeverity(req, res, next);
});

describe('GET /incident-severity - getIncidentSeverity Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 204 when no severity data found', async () => {
    incidentService.getIncidentSeverity.mockResolvedValue({
      total: { low: 0, medium: 0, high: 0 },
    });

    const response = await request(app).get('/incident-severity');
    expect(response.status).toBe(204);
    // ✅ For 204, body is empty
    expect(response.body).toEqual({});
  });

  test('should return 200 with severity data when available', async () => {
    const mockData = {
      total: { low: 2, medium: 3, high: 1 },
      details: [{ severity: 'high', count: 1 }],
    };
    incidentService.getIncidentSeverity.mockResolvedValue(mockData);

    const response = await request(app).get('/incident-severity');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockData,
      message: 'Incident severity data fetched successfully',
    });
  });

  test('should call next() on service error', async () => {
    const mockError = new Error('Service failure');
    incidentService.getIncidentSeverity.mockRejectedValue(mockError);

    const next = jest.fn();
    await getIncidentSeverity({ customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalledWith(mockError);
  });
});
