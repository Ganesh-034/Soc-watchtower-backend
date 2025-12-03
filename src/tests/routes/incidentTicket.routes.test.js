
// File: src/tests/routes/incidentTicket.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
};

let controllerImpl = {
  getIncidentTickets: (req, res, next) => res.status(200).json([{ id: 'INC-1', status: 'Open' }]),
};

jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incidentTicket.controller.js', () => ({
  getIncidentTickets: jest.fn((req, res, next) => controllerImpl.getIncidentTickets(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incidentTicket.routes.js'); // GET /incident_ticket_table, with authenticate + attachCustomerInfo
const ticketRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const incidentTicketController = await import('../../controllers/incidentTicket.controller.js');

describe('Routes: /incident_ticket_table', () => {
  let app;

  beforeEach(() => {
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
    };

    controllerImpl = {
      getIncidentTickets: (req, res, next) => res.status(200).json([{ id: 'INC-1', status: 'Open' }]),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', ticketRouter);

    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/incident_ticket_table → 200 success with data', async () => {
    controllerImpl.getIncidentTickets = (req, res, next) => {
      res.status(200).json([
        { id: 'INC-1', status: 'Open' },
        { id: 'INC-2', status: 'Closed' },
      ]);
    };

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'INC-1', status: 'Open' },
      { id: 'INC-2', status: 'Closed' },
    ]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentTicketController.getIncidentTickets).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incident_ticket_table → 204 when empty', async () => {
    controllerImpl.getIncidentTickets = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('GET /incident/incident_ticket_table → 400 validation error (invalid `page`)', async () => {
    controllerImpl.getIncidentTickets = (req, res, next) => {
      const page = Number(req.query?.page);
      if (Number.isNaN(page) || page <= 0) {
        return next(Object.assign(new Error('`page` must be a positive number'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ id: 'INC-3', status: 'Open' }]);
    };

    const res = await request(app).get('/incident/incident_ticket_table').query({ page: 'oops' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`page` must be a positive number' });
    expect(incidentTicketController.getIncidentTickets).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incident_ticket_table → 503 service error via next()', async () => {
    controllerImpl.getIncidentTickets = (req, res, next) =>
      next(Object.assign(new Error('DB down'), { status: 503 }));

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'DB down' });
  });

  test('GET /incident/incident_ticket_table → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentTicketController.getIncidentTickets).not.toHaveBeenCalled();
  });

  test('GET /incident/incident_ticket_table → 400 when attachCustomerInfo fails via next()', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(incidentTicketController.getIncidentTickets).not.toHaveBeenCalled();
  });

  test('GET /incident/incident_ticket_table → 400 when req.customer missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getIncidentTickets = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ id: 'INC-5', status: 'Closed' }]);
    };

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(incidentTicketController.getIncidentTickets).toHaveBeenCalledTimes(1);
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-y' }; next(); };
    controllerImpl.getIncidentTickets = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ id: 'INC-6', status: 'Open' }]); };

    const res = await request(app).get('/incident/incident_ticket_table');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'INC-6', status: 'Open' }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
