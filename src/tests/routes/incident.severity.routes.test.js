
// File: src/tests/routes/incident.severity.routes.test.js
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
  getIncidentSeverity: (req, res, next) => res.status(200).json([{ severity: 'High', total: 2 }]),
};

// Mocks for middlewares and controller used by the router
jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incident.severity.controller.js', () => ({
  getIncidentSeverity: jest.fn((req, res, next) => controllerImpl.getIncidentSeverity(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incident.severity.routes.js'); // GET /incidents_by_severity, with authenticate + attachCustomerInfo
const severityRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const incidentSeverityController = await import('../../controllers/incident.severity.controller.js');

describe('Routes: /incidents_by_severity', () => {
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
      getIncidentSeverity: (req, res, next) => res.status(200).json([{ severity: 'High', total: 2 }]),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', severityRouter);

    // test-only error handler
    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/incidents_by_severity → 200 success with data', async () => {
    controllerImpl.getIncidentSeverity = (req, res, next) => {
      res.status(200).json([
        { severity: 'Critical', total: 3 },
        { severity: 'High', total: 5 },
        { severity: 'Medium', total: 2 },
      ]);
    };

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { severity: 'Critical', total: 3 },
      { severity: 'High', total: 5 },
      { severity: 'Medium', total: 2 },
    ]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentSeverityController.getIncidentSeverity).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incidents_by_severity → 204 when empty result', async () => {
    controllerImpl.getIncidentSeverity = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(incidentSeverityController.getIncidentSeverity).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incidents_by_severity → 400 validation error (missing `from`)', async () => {
    controllerImpl.getIncidentSeverity = (req, res, next) => {
      if (!req.query?.from) {
        return next(Object.assign(new Error('`from` query is required'), { name: 'ValidationError', status: 400 }));
      }
      return res.status(200).json([]);
    };

    const res = await request(app).get('/incident/incidents_by_severity'); // no query

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`from` query is required' });
    expect(incidentSeverityController.getIncidentSeverity).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incidents_by_severity → 503 service error via next()', async () => {
    controllerImpl.getIncidentSeverity = (req, res, next) => {
      return next(Object.assign(new Error('Service unavailable'), { status: 503 }));
    };

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Service unavailable' });
  });

  test('GET /incident/incidents_by_severity → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentSeverityController.getIncidentSeverity).not.toHaveBeenCalled();
  });

  test('GET /incident/incidents_by_severity → 400 when attachCustomerInfo calls next(err)', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(incidentSeverityController.getIncidentSeverity).not.toHaveBeenCalled();
  });

  test('GET /incident/incidents_by_severity → 400 when req.customer is missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getIncidentSeverity = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ severity: 'Low', total: 1 }]);
    };

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(incidentSeverityController.getIncidentSeverity).toHaveBeenCalledTimes(1);
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-x' }; next(); };
    controllerImpl.getIncidentSeverity = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ severity: 'High', total: 1 }]); };

    const res = await request(app).get('/incident/incidents_by_severity');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ severity: 'High', total: 1 }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
