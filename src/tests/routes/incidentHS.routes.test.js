
// File: src/tests/routes/incidentHS.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
};

let controllerImpl = {
  getIncidentsHandlingStatus: (req, res, next) => res.status(200).json([{ status: 'Open', total: 8 }]),
};

jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incidentHS.controller.js', () => ({
  getIncidentsHandlingStatus: jest.fn((req, res, next) => controllerImpl.getIncidentsHandlingStatus(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incidentHS.routes.js'); // GET /total_incidents_hs, with authenticate + attachCustomerInfo
const hsRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const incidentHSController = await import('../../controllers/incidentHS.controller.js');

describe('Routes: /total_incidents_hs', () => {
  let app;

  beforeEach(() => {
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
    };

    controllerImpl = {
      getIncidentsHandlingStatus: (req, res, next) => res.status(200).json([{ status: 'Open', total: 8 }]),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', hsRouter);

    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/total_incidents_hs → 200 success with data', async () => {
    controllerImpl.getIncidentsHandlingStatus = (req, res, next) => {
      res.status(200).json([
        { status: 'Open', total: 8 },
        { status: 'In Progress', total: 3 },
        { status: 'Closed', total: 10 },
      ]);
    };

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { status: 'Open', total: 8 },
      { status: 'In Progress', total: 3 },
      { status: 'Closed', total: 10 },
    ]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentHSController.getIncidentsHandlingStatus).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_hs → 204 when empty', async () => {
    controllerImpl.getIncidentsHandlingStatus = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('GET /incident/total_incidents_hs → 400 validation error (invalid `status`)', async () => {
    controllerImpl.getIncidentsHandlingStatus = (req, res, next) => {
      const valid = ['Open', 'In Progress', 'Closed'];
      if (req.query?.status && !valid.includes(req.query.status)) {
        return next(Object.assign(new Error('`status` query is invalid'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ status: req.query?.status ?? 'Open', total: 1 }]);
    };

    const res = await request(app).get('/incident/total_incidents_hs').query({ status: 'INVALID' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`status` query is invalid' });
    expect(incidentHSController.getIncidentsHandlingStatus).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_hs → 503 service error via next()', async () => {
    controllerImpl.getIncidentsHandlingStatus = (req, res, next) =>
      next(Object.assign(new Error('Service unavailable'), { status: 503 }));

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Service unavailable' });
  });

  test('GET /incident/total_incidents_hs → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentHSController.getIncidentsHandlingStatus).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents_hs → 400 when attachCustomerInfo fails via next()', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(incidentHSController.getIncidentsHandlingStatus).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents_hs → 400 when req.customer missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getIncidentsHandlingStatus = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ status: 'Closed', total: 1 }]);
    };

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(incidentHSController.getIncidentsHandlingStatus).toHaveBeenCalledTimes(1);
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-z' }; next(); };
    controllerImpl.getIncidentsHandlingStatus = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ status: 'Open', total: 2 }]); };

    const res = await request(app).get('/incident/total_incidents_hs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ status: 'Open', total: 2 }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
