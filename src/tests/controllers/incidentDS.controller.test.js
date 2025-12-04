
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../services/incidentDS.service.js', () => ({
  getIncidentsDetectionSource: jest.fn(),
}));

const incidentService = await import('../../services/incidentDS.service.js');
const { getIncidentsDetectionSource } = await import('../../controllers/incidentDS.controller.js');

const app = express();
app.use(express.json());
app.get('/incident-ds', (req, res, next) => {
  req.customerName = 'ACME';
  getIncidentsDetectionSource(req, res, next);
});

describe('GET /incident-ds - getIncidentsDetectionSource Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should throw 400 if month is missing', async () => {
    const next = jest.fn();
    await getIncidentsDetectionSource({ query: {}, customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('should throw 422 if month format is invalid', async () => {
    const next = jest.fn();
    await getIncidentsDetectionSource({ query: { month: '2024/01' }, customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 204 when no detection source data found', async () => {
    incidentService.getIncidentsDetectionSource.mockResolvedValue({
      detectionsource: {},
    });

    const response = await request(app).get('/incident-ds').query({ month: '2024-01' });
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  test('should return 200 with detection source data', async () => {
    const mockData = {
      detectionsource: { email: 5, network: 3 },
    };
    incidentService.getIncidentsDetectionSource.mockResolvedValue(mockData);

    const response = await request(app).get('/incident-ds').query({ month: '2024-01' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockData,
      message: 'Incident counts by Detection source fetched successfully',
    });
  });
});
