
// File: src/tests/routes/incident.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

/**
 * We provide mutable implementations for middlewares and controller so each test
 * can tailor behavior (success, validation error, empty data, service error, etc.).
 */
let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => {
    req.customer = { id: 'cust-123' };
    next();
  },
};

let controllerImpl = {
  getTotalIncidents: (req, res, next) => res.status(200).json({ total: 2 }),
};

// Mock the middlewares used by the router.
jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

// Mock the controller used by the router.
jest.unstable_mockModule('../../controllers/incident.controller.js', () => ({
  getTotalIncidents: jest.fn((req, res, next) => controllerImpl.getTotalIncidents(req, res, next)),
}));

// Import AFTER mocks
const routerModule = await import('../../routes/incident.routes.js');
const incidentRouter = routerModule.default;

// Also import the mocked modules so we can make call-count/order assertions.
const auth = await import('../../middlewares/auth.js');
const incidentController = await import('../../controllers/incident.controller.js');

describe('Routes: /total_incidents', () => {
  let app;

  beforeEach(() => {
    // reset default impls for each test
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => {
        req.customer = { id: 'cust-123' };
        next();
      },
    };

    controllerImpl = {
      getTotalIncidents: (req, res, next) => res.status(200).json({ total: 2 }),
    };

    app = express();
    app.use(express.json());

    // Mount the router under a base path for clarity
    app.use('/incident', incidentRouter);

    // Test-only error handler to assert next(err) propagation
    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      const name = err?.name ?? 'Error';
      const message = err?.message ?? 'Unknown error';
      res.status(status).json({ name, message });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/total_incidents → 200 success with data', async () => {
    controllerImpl.getTotalIncidents = (req, res, next) => {
      // Simulate successful service response
      res.status(200).json({ total: 5, range: { from: '2024-01-01', to: '2024-12-31' } });
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 5, range: { from: '2024-01-01', to: '2024-12-31' } });

    // middleware + controller called
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentController.getTotalIncidents).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents → 204 when no incidents (empty data)', async () => {
    controllerImpl.getTotalIncidents = (req, res, next) => {
      // Simulate empty dataset
      res.status(204).send();
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(204);
    // 204 must not return a body; supertest exposes {} for JSON body
    expect(res.body).toEqual({});
    expect(incidentController.getTotalIncidents).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents → 400 validation error (missing `from` query)', async () => {
    controllerImpl.getTotalIncidents = (req, res, next) => {
      // Controller expects ?from=...&to=..., raise validation error if missing
      if (!req.query?.from) {
        const err = Object.assign(new Error('`from` query is required'), {
          name: 'ValidationError',
          status: 400,
        });
        return next(err);
      }
      res.status(200).json({ total: 1 });
    };

    const res = await request(app).get('/incident/total_incidents'); // no query

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`from` query is required' });

    // ensure error propagation via next() occurred
    expect(incidentController.getTotalIncidents).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents → 503 service error propagates via next()', async () => {
    controllerImpl.getTotalIncidents = (req, res, next) => {
      const boom = Object.assign(new Error('Database unavailable'), { status: 503 });
      return next(boom);
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Database unavailable' });
    expect(incidentController.getTotalIncidents).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents → 401 when authenticate blocks request', async () => {
    // simulate auth middleware responding early (no next())
    authImpl.authenticate = (req, res, next) => {
      return res.status(401).json({ message: 'Unauthorized' });
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });

    // attachCustomerInfo and controller must NOT be called
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentController.getTotalIncidents).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents → 400 when attachCustomerInfo fails via next()', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => {
      const err = Object.assign(new Error('Customer not found'), {
        name: 'ValidationError',
        status: 400,
      });
      return next(err);
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });

    // controller must NOT be called
    expect(incidentController.getTotalIncidents).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents → 400 when customer context missing', async () => {
    // attachCustomerInfo does not attach req.customer but calls next()
    authImpl.attachCustomerInfo = (req, res, next) => next();

    // controller validates presence of req.customer
    controllerImpl.getTotalIncidents = (req, res, next) => {
      if (!req.customer) {
        const err = Object.assign(new Error('Customer context is required'), {
          name: 'ValidationError',
          status: 400,
        });
        return next(err);
      }
      res.status(200).json({ total: 10 });
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(incidentController.getTotalIncidents).toHaveBeenCalledTimes(1);
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];

    authImpl.authenticate = (req, res, next) => {
      sequence.push('authenticate');
      next();
    };

    authImpl.attachCustomerInfo = (req, res, next) => {
      sequence.push('attachCustomerInfo');
      req.customer = { id: 'cust-xyz' };
      next();
    };

    controllerImpl.getTotalIncidents = (req, res, next) => {
      sequence.push('controller');
      res.status(200).json({ total: 3 });
    };

    const res = await request(app).get('/incident/total_incidents');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 3 });
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
