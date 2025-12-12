
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../services/incidentView.service.js', () => ({
  getIncidentDetails: jest.fn(),
}));

const viewService = await import('../../services/incidentView.service.js');
const { getIncidentDetailsById } = await import('../../controllers/incidentView.controller.js');

const app = express();
app.get('/incident-view/:id', (req, res, next) => {
  req.customerName = 'ACME';
  getIncidentDetailsById(req, res, next);
});

describe('GET /incident-view/:id - getIncidentDetailsById Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should throw 400 if id is missing', async () => {
    const next = jest.fn();
    await getIncidentDetailsById({ params: {}, customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 204 when no incident details found', async () => {
    viewService.getIncidentDetails.mockResolvedValue({});
    const response = await request(app).get('/incident-view/123');
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  test('should return 200 with incident details', async () => {
    const mockData = { id: '123', subject: 'Test Incident' };
    viewService.getIncidentDetails.mockResolvedValue(mockData);
    const response = await request(app).get('/incident-view/123');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockData,
      message: 'Incident details fetched successfully',
    });
  });

  test('should call next() on service error', async () => {
    const mockError = new Error('Service failure');
    viewService.getIncidentDetails.mockRejectedValue(mockError);
    const next = jest.fn();
    await getIncidentDetailsById({ params: { id: '123' }, customerName: 'ACME' }, {}, next);
    expect(next).toHaveBeenCalledWith(mockError);
  });
});
