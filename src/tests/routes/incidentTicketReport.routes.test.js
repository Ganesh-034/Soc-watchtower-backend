
// File: src/tests/routes/incidentTicketReport.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
};

let controllerImpl = {
  getHealthEscalationIncidentsCtrl: (req, res, next) => res.status(200).json([{ id: 'INC-10', escalated: true, type: 'Health' }]),
  getNonHealthEscalationIncidentsCtrl: (req, res, next) => res.status(200).json([{ id: 'INC-20', escalated: true, type: 'Non-Health' }]),
};

jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

jest.unstable_mockModule('../../controllers/incidentTicketReport.controller.js', () => ({
  getHealthEscalationIncidentsCtrl: jest.fn((req, res, next) => controllerImpl.getHealthEscalationIncidentsCtrl(req, res, next)),
  getNonHealthEscalationIncidentsCtrl: jest.fn((req, res, next) => controllerImpl.getNonHealthEscalationIncidentsCtrl(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/incidentTicketReport.routes.js'); // GET /health-escalation, /non-health-escalation; with authenticate + attachCustomerInfo
const reportRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const reportController = await import('../../controllers/incidentTicketReport.controller.js');

describe('Routes: /health-escalation & /non-health-escalation', () => {
  let app;

  beforeEach(() => {
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
    };

    controllerImpl = {
      getHealthEscalationIncidentsCtrl: (req, res, next) => res.status(200).json([{ id: 'INC-10', escalated: true, type: 'Health' }]),
      getNonHealthEscalationIncidentsCtrl: (req, res, next) => res.status(200).json([{ id: 'INC-20', escalated: true, type: 'Non-Health' }]),
    };

    app = express();
    app.use(express.json());
    app.use('/incident', reportRouter);

    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  // --------- /health-escalation tests ---------

  test('GET /incident/health-escalation → 200 success with data', async () => {
    controllerImpl.getHealthEscalationIncidentsCtrl = (req, res, next) =>
      res.status(200).json([{ id: 'INC-11', escalated: true, type: 'Health' }]);

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'INC-11', escalated: true, type: 'Health' }]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(reportController.getHealthEscalationIncidentsCtrl).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/health-escalation → 204 when empty', async () => {
    controllerImpl.getHealthEscalationIncidentsCtrl = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('GET /incident/health-escalation → 400 validation error (missing `month`/`year`)', async () => {
    controllerImpl.getHealthEscalationIncidentsCtrl = (req, res, next) => {
      const { month, year } = req.query ?? {};
      if (!month || !year) {
        return next(Object.assign(new Error('`month` and `year` queries are required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ id: 'INC-12', escalated: true, type: 'Health', month, year }]);
    };

    const res = await request(app).get('/incident/health-escalation'); // missing queries

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`month` and `year` queries are required' });
    expect(reportController.getHealthEscalationIncidentsCtrl).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/health-escalation → 503 service error via next()', async () => {
    controllerImpl.getHealthEscalationIncidentsCtrl = (req, res, next) =>
      next(Object.assign(new Error('Analytics service unavailable'), { status: 503 }));

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Analytics service unavailable' });
  });

  test('GET /incident/health-escalation → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(reportController.getHealthEscalationIncidentsCtrl).not.toHaveBeenCalled();
  });

  test('GET /incident/health-escalation → 400 when attachCustomerInfo fails via next()', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(reportController.getHealthEscalationIncidentsCtrl).not.toHaveBeenCalled();
  });

  test('GET /incident/health-escalation → 400 when req.customer missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getHealthEscalationIncidentsCtrl = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ id: 'INC-13', escalated: true, type: 'Health' }]);
    };

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(reportController.getHealthEscalationIncidentsCtrl).toHaveBeenCalledTimes(1);
  });

  test('Middleware order (/health-escalation): authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-z' }; next(); };
    controllerImpl.getHealthEscalationIncidentsCtrl = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ id: 'INC-14', escalated: true, type: 'Health' }]); };

    const res = await request(app).get('/incident/health-escalation');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'INC-14', escalated: true, type: 'Health' }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });

  // --------- /non-health-escalation tests ---------

  test('GET /incident/non-health-escalation → 200 success with data', async () => {
    controllerImpl.getNonHealthEscalationIncidentsCtrl = (req, res, next) =>
      res.status(200).json([{ id: 'INC-21', escalated: true, type: 'Non-Health' }]);

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'INC-21', escalated: true, type: 'Non-Health' }]);
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(reportController.getNonHealthEscalationIncidentsCtrl).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/non-health-escalation → 204 when empty', async () => {
    controllerImpl.getNonHealthEscalationIncidentsCtrl = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('GET /incident/non-health-escalation → 400 validation error (invalid `month`/`year`)', async () => {
    controllerImpl.getNonHealthEscalationIncidentsCtrl = (req, res, next) => {
      const { month, year } = req.query ?? {};
      if (!month || !year || Number.isNaN(Number(month)) || Number.isNaN(Number(year))) {
        return next(Object.assign(new Error('`month` and `year` must be numeric'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ id: 'INC-22', escalated: true, type: 'Non-Health', month: Number(month), year: Number(year) }]);
    };

    const res = await request(app).get('/incident/non-health-escalation').query({ month: 'Oct', year: '2025' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`month` and `year` must be numeric' });
    expect(reportController.getNonHealthEscalationIncidentsCtrl).toHaveBeenCalledTimes(1);
  });

  test('GET /incident/non-health-escalation → 503 service error via next()', async () => {
    controllerImpl.getNonHealthEscalationIncidentsCtrl = (req, res, next) =>
      next(Object.assign(new Error('Reporting service down'), { status: 503 }));

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Reporting service down' });
  });

  test('GET /incident/non-health-escalation → 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(reportController.getNonHealthEscalationIncidentsCtrl).not.toHaveBeenCalled();
  });

  test('GET /incident/non-health-escalation → 400 when attachCustomerInfo fails via next()', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(reportController.getNonHealthEscalationIncidentsCtrl).not.toHaveBeenCalled();
  });

  test('GET /incident/non-health-escalation → 400 when req.customer missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    controllerImpl.getNonHealthEscalationIncidentsCtrl = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ id: 'INC-23', escalated: true, type: 'Non-Health' }]);
    };

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
    expect(reportController.getNonHealthEscalationIncidentsCtrl).toHaveBeenCalledTimes(1);
  });

  test('Middleware order (/non-health-escalation): authenticate → attachCustomerInfo → controller', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-w' }; next(); };
    controllerImpl.getNonHealthEscalationIncidentsCtrl = (req, res, next) => { sequence.push('controller'); res.status(200).json([{ id: 'INC-24', escalated: true, type: 'Non-Health' }]); };

    const res = await request(app).get('/incident/non-health-escalation');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'INC-24', escalated: true, type: 'Non-Health' }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'controller']);
  });
});
