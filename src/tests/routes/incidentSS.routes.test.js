
// File: src/tests/routes/incidentSS.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mutable implementations swapped per-test
let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => {
    req.customer = { id: 'cust-123' };
    next();
  },
};

let controllerImpl = {
  getIncidentsSubStatus: (req, res, next) => res.status(200).json([{ subStatus: 'Awaiting User', total: 2 }]),
};

// Mocks for middlewares and controller used by the router
jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incidentSS.controller.js', () => ({
  getIncidentsSubStatus: jest.fn((req, res, next) => controllerImpl.getIncidentsSubStatus(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incidentSS.routes.js'); // GET /total_incidents_ss, with authenticate + attachCustomerInfo
const ssRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const incidentSSController = await import('../../controllers/incidentSS.controller.js');

describe('Routes: /total_incidents_ss', () => {
  let app;

  beforeEach(() => {
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => {
        req.customer = { id: 'cust-123' };
        next();
      },
    };

    controllerImpl = {
      getIncidentsSubStatus: (req, res, next) => res.status(200).json([{ subStatus: 'Awaiting User', total: 2 }]),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', ssRouter);

    // test-only error handler
    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/total_incidents_ss → 200 success with data', async () => {
    controllerImpl.getIncidentsSubStatus = (req, res, next) => {
      res.status(200).json([
        { subStatus: 'Awaiting User', total: 3 },
        { subStatus: 'Awaiting Vendor', total: 1 },
      ]);
    };

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { subStatus: 'Awaiting User', total: 3 },
      { subStatus: 'Awaiting Vendor', total: 1 },
    ]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentSSController.getIncidentsSubStatus).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_ss → 204 when empty result', async () => {
    controllerImpl.getIncidentsSubStatus = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(incidentSSController.getIncidentsSubStatus).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_ss → 400 validation error (missing `subStatus`)', async () => {
    controllerImpl.getIncidentsSubStatus = (req, res, next) => {
      if (!req.query?.subStatus) {
        return next(Object.assign(new Error('`subStatus` query is required'), { name: 'ValidationError', status: 400 }));
      }
      return res.status(200).json([{ subStatus: req.query.subStatus, total: 1 }]);
    };

    const res = await request(app).get('/incident/total_incidents_ss'); // no query

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`subStatus` query is required' });
    expect(incidentSSController.getIncidentsSubStatus).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_ss → 503 service error via next()', async () => {
    controllerImpl.getIncidentsSubStatus = (req, res, next) => {
      return next(Object.assign(new Error('Service unavailable'), { status: 503 }));
    };

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Service unavailable' });
  });

  test('GET /incident/total_incidents_ss → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentSSController.getIncidentsSubStatus).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents_ss → 400 when attachCustomerInfo calls next(err)', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(incidentSSController.getIncidentsSubStatus).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents_ss → 400 when req.customer is missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getIncidentsSubStatus = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ subStatus: 'Awaiting User', total: 1 }]);
    };

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(incidentSSController.getIncidentsSubStatus).toHaveBeenCalledTimes(1);
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-x' }; next(); };
    controllerImpl.getIncidentsSubStatus = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ subStatus: 'Awaiting Vendor', total: 1 }]); };

    const res = await request(app).get('/incident/total_incidents_ss');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ subStatus: 'Awaiting Vendor', total: 1 }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
