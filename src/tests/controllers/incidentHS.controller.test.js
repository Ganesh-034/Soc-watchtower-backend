
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../services/incidentHS.service.js', () => ({
  getIncidentsHandlingStatus: jest.fn(),
}));

const incidentService = await import('../../services/incidentHS.service.js');
const { getIncidentsHandlingStatus } = await import('../../controllers/incidentHS.controller.js');

const app = express();
app.use(express.json());
app.get('/incident-hs', (req, res, next) => {
  req.customerName = 'ACME';
  getIncidentsHandlingStatus(req, res, next);
});

describe('GET /incident-hs - getIncidentsHandlingStatus Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should return 204 when no handling status data found', async () => {
    incidentService.getIncidentsHandlingStatus.mockResolvedValue({});

    const response = await request(app).get('/incident-hs');
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  test('should return 200 with handling status data', async () => {
    const mockData = { open: 5, closed: 3 };
    incidentService.getIncidentsHandlingStatus.mockResolvedValue(mockData);

    const response = await request(app).get('/incident-hs');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockData,
      message: 'Incident counts by Handling Status fetched successfully',
    });
  });

  test('should call next() on service error', async () => {
    const mockError = new Error('Service failure');
    incidentService.getIncidentsHandlingStatus.mockRejectedValue(mockError);

    const next = jest.fn();
    await getIncidentsHandlingStatus({ customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalledWith(mockError);
  });
});
