
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../services/incidentTicket.service.js', () => ({
  getIncidentTickets: jest.fn(),
}));

const incidentService = await import('../../services/incidentTicket.service.js');
const { getIncidentTickets } = await import('../../controllers/incidentTicket.controller.js');

const app = express();
app.use(express.json());
app.get('/incident-tickets', (req, res, next) => {
  req.customerName = 'ACME';
  getIncidentTickets(req, res, next);
});

describe('GET /incident-tickets - getIncidentTickets Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should return 400 for invalid filter JSON', async () => {
    const response = await request(app)
      .get('/incident-tickets')
      .query({ filters: 'invalid-json' });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid filter format');
  });

  test('should return 400 if customerName is missing', async () => {
    const req = { query: {}, customerName: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await getIncidentTickets(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 204 when no tickets found', async () => {
    incidentService.getIncidentTickets.mockResolvedValue({ tickets: [] });
    const response = await request(app).get('/incident-tickets');
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  test('should return 200 with tickets data', async () => {
    const mockData = { tickets: [{ id: '123', subject: 'Test' }] };
    incidentService.getIncidentTickets.mockResolvedValue(mockData);
    const response = await request(app).get('/incident-tickets');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: mockData,
      message: 'Incident tickets fetched successfully',
    });
  });

  test('should return 500 on service error', async () => {
    incidentService.getIncidentTickets.mockRejectedValue(new Error('Service failure'));
    const response = await request(app).get('/incident-tickets');
    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Internal server error');
  });
});
