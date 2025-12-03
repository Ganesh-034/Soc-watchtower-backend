
// File: src/tests/routes/incidentDS.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
};

let controllerImpl = {
  getIncidentsDetectionSource: (req, res, next) => res.status(200).json([{ source: 'SIEM', total: 7 }]),
};

jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incidentDS.controller.js', () => ({
  getIncidentsDetectionSource: jest.fn((req, res, next) => controllerImpl.getIncidentsDetectionSource(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incidentDS.routes.js'); // GET /total_incidents_ds, with authenticate + attachCustomerInfo
const dsRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const incidentDSController = await import('../../controllers/incidentDS.controller.js');

describe('Routes: /total_incidents_ds', () => {
  let app;

  beforeEach(() => {
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
    };

    controllerImpl = {
      getIncidentsDetectionSource: (req, res, next) => res.status(200).json([{ source: 'SIEM', total: 7 }]),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', dsRouter);

    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  test('GET /incident/total_incidents_ds → 200 success with data', async () => {
    controllerImpl.getIncidentsDetectionSource = (req, res, next) => {
      res.status(200).json([
        { source: 'SIEM', total: 7 },
        { source: 'EDR', total: 4 },
        { source: 'Email', total: 2 },
      ]);
    };

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { source: 'SIEM', total: 7 },
      { source: 'EDR', total: 4 },
      { source: 'Email', total: 2 },
    ]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(incidentDSController.getIncidentsDetectionSource).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_ds → 204 when empty', async () => {
    controllerImpl.getIncidentsDetectionSource = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('GET /incident/total_incidents_ds → 400 validation error (missing `source`)', async () => {
    controllerImpl.getIncidentsDetectionSource = (req, res, next) => {
      if (!req.query?.source) {
        return next(Object.assign(new Error('`source` query is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ source: req.query.source, total: 1 }]);
    };

    const res = await request(app).get('/incident/total_incidents_ds'); // no query

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`source` query is required' });
    expect(incidentDSController.getIncidentsDetectionSource).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/total_incidents_ds → 503 service error via next()', async () => {
    controllerImpl.getIncidentsDetectionSource = (req, res, next) => {
      return next(Object.assign(new Error('DB down'), { status: 503 }));
    };

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'DB down' });
  });

  test('GET /incident/total_incidents_ds → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(incidentDSController.getIncidentsDetectionSource).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents_ds → 400 when attachCustomerInfo fails via next()', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(incidentDSController.getIncidentsDetectionSource).not.toHaveBeenCalled();
  });

  test('GET /incident/total_incidents_ds → 400 when req.customer missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getIncidentsDetectionSource = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      return res.status(200).json([{ source: 'SIEM', total: 1 }]);
    };

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
  });

  test('Middleware order: authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-y' }; next(); };
    controllerImpl.getIncidentsDetectionSource = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ source: 'SIEM', total: 3 }]); };

    const res = await request(app).get('/incident/total_incidents_ds');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ source: 'SIEM', total: 3 }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
