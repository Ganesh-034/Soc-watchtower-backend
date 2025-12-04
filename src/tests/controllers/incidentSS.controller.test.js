
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../services/incidentSS.service.js', () => ({
  getIncidentsSubStatus: jest.fn(),
}));

const incidentService = await import('../../services/incidentSS.service.js');
const { getIncidentsSubStatus } = await import('../../controllers/incidentSS.controller.js');

const app = express();
app.use(express.json());
app.get('/incident-ss', (req, res, next) => {
  req.customerName = 'ACME';
  getIncidentsSubStatus(req, res, next);
});

describe('GET /incident-ss - getIncidentsSubStatus Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should throw 400 if month is missing', async () => {
    const next = jest.fn();
    await getIncidentsSubStatus({ query: {}, customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('should throw 422 if month format is invalid', async () => {
    const next = jest.fn();
    await getIncidentsSubStatus({ query: { month: '2024/01' }, customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 204 when no substatus data found', async () => {
    incidentService.getIncidentsSubStatus.mockResolvedValue({ substatus: [] });

    const response = await request(app).get('/incident-ss').query({ month: '2024-01' });
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  test('should return 200 with substatus data', async () => {
    const mockData = { substatus: [{ status: 'Investigating', count: 2 }] };
    incidentService.getIncidentsSubStatus.mockResolvedValue(mockData);

    const response = await request(app).get('/incident-ss').query({ month: '2024-01' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockData,
      message: 'Incident counts by Sub Status fetched successfully',
    });
  });
});
