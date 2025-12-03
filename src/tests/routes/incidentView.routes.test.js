
// File: src/tests/routes/incidentView.routes.test.js
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
  getIncidentDetailsById: (req, res, next) =>
    res.status(200).json({ id: req.params.id, status: 'Open', title: 'Test Incident' }),
};

// Mocks for middlewares and controller used by the router
jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incidentView.controller.js', () => ({
  getIncidentDetailsById: jest.fn((req, res, next) => controllerImpl.getIncidentDetailsById(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incidentView.routes.js'); // GET /incident_view/:id, with authenticate + attachCustomerInfo
const incidentViewRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const incidentViewController = await import('../../controllers/incidentView.controller.js');

describe('Routes: /incident_view/:id', () => {
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
      getIncidentDetailsById: (req, res, next) =>
        res.status(200).json({ id: req.params.id, status: 'Open', title: 'Test Incident' }),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', incidentViewRouter);

    // test-only error handler
    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/incident_view/:id → 200 success with data', async () => {
    controllerImpl.getIncidentDetailsById = (req, res, next) =>
      res.status(200).json({ id: '123', status: 'Open', title: 'Network issue' });

    const res = await request(app).get('/incident/incident_view/123');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '123', status: 'Open', title: 'Network issue' });
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentViewController.getIncidentDetailsById).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incident_view/:id → 204 when incident not found', async () => {
    controllerImpl.getIncidentDetailsById = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/incident_view/999');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(incidentViewController.getIncidentDetailsById).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incident_view/:id → 400 validation error (invalid id)', async () => {
    controllerImpl.getIncidentDetailsById = (req, res, next) => {
      const { id } = req.params;
      if (!/^[0-9]+$/.test(id)) {
        return next(Object.assign(new Error('`id` must be a numeric string'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json({ id, status: 'Open' });
    };

    const res = await request(app).get('/incident/incident_view/abc');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`id` must be a numeric string' });
    expect(incidentViewController.getIncidentDetailsById).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/incident_view/:id → 503 service error via next()', async () => {
    controllerImpl.getIncidentDetailsById = (req, res, next) =>
      next(Object.assign(new Error('Database unavailable'), { status: 503 }));

    const res = await request(app).get('/incident/incident_view/123');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Database unavailable' });
  });

  test('GET /incident/incident_view/:id → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/incident_view/123');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentViewController.getIncidentDetailsById).not.toHaveBeenCalled();
  });

  test('GET /incident/incident_view/:id → 400 when attachCustomerInfo calls next(err)', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/incident_view/123');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(incidentViewController.getIncidentDetailsById).not.toHaveBeenCalled();
  });

  test('GET /incident/incident_view/:id → 400 when req.customer is missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getIncidentDetailsById = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json({ id: '123', status: 'Closed' });
    };

    const res = await request(app).get('/incident/incident_view/123');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(incidentViewController.getIncidentDetailsById).toHaveBeenCalledTimes(1);
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-x' }; next(); };
    controllerImpl.getIncidentDetailsById = (req, res, next) => { sequence.push('controller'); res.status(200).json({ id: '777' }); };

    const res = await request(app).get('/incident/incident_view/777');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '777' });
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
