
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ✅ Mock service module
jest.unstable_mockModule('../../services/incident.service.js', () => ({
  getTotalIncidents: jest.fn(),
}));

const incidentService = await import('../../services/incident.service.js');
const { getTotalIncidents } = await import('../../controllers/incident.controller.js');

const app = express();
app.use(express.json());
app.get('/incidents', (req, res, next) => {
  req.customerName = 'ACME';
  getTotalIncidents(req, res, next);
});

describe('GET /incidents - getTotalIncidents Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 204 when no incidents found', async () => {
    incidentService.getTotalIncidents.mockResolvedValue({ total: 0 });

    const response = await request(app).get('/incidents');
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  test('should return 200 with incident counts when data exists', async () => {
    const mockCounts = { total: 5, open: 3, closed: 2 };
    incidentService.getTotalIncidents.mockResolvedValue(mockCounts);

    const response = await request(app).get('/incidents');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockCounts,
      message: 'Incident counts fetched successfully',
    });
  });

  test('should call next() on error', async () => {
    const mockError = new Error('Service failure');
    incidentService.getTotalIncidents.mockRejectedValue(mockError);

    const next = jest.fn();
    await getTotalIncidents({ customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalledWith(mockError);
  });
});
