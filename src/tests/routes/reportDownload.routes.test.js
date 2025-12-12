
// File: src/tests/routes/reportDownload.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let authImpl = {
  authenticate: (req, res, next) => next(),
  attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
};

let downloadImpl = {
  getReportSasUrl: (req, res, next) => res.status(200).json({ url: 'https://blob/sas-token' }),
  getAvailableReportsForCustomer: (req, res, next) => res.status(200).json([{ name: 'Oct-2025.pdf' }]),
  debugReports: (req, res, next) => res.status(200).json({ ok: true }),
  clearTestReports: (req, res, next) => res.status(200).json({ cleared: 5 }),
  createTestReport: (req, res, next) => res.status(200).json({ created: true }),
  createMultipleTestReports: (req, res, next) => res.status(200).json({ created: 3 }),
};

// Mock middlewares
jest.unstable_mockModule('../../middlewares/auth.js', () => ({
  authenticate: jest.fn((req, res, next) => authImpl.authenticate(req, res, next)),
  attachCustomerInfo: jest.fn((req, res, next) => authImpl.attachCustomerInfo(req, res, next)),
}));

// Mock service route handlers
jest.unstable_mockModule('../../services/reportDownload.service.js', () => ({
  getReportSasUrl: jest.fn((req, res, next) => downloadImpl.getReportSasUrl(req, res, next)),
  getAvailableReportsForCustomer: jest.fn((req, res, next) => downloadImpl.getAvailableReportsForCustomer(req, res, next)),
  debugReports: jest.fn((req, res, next) => downloadImpl.debugReports(req, res, next)),
  clearTestReports: jest.fn((req, res, next) => downloadImpl.clearTestReports(req, res, next)),
  createTestReport: jest.fn((req, res, next) => downloadImpl.createTestReport(req, res, next)),
  createMultipleTestReports: jest.fn((req, res, next) => downloadImpl.createMultipleTestReports(req, res, next)),
}));

// Import router AFTER mocks
const routerModule = await import('../../routes/reportDownload.routes.js'); // SAS url + customer + debug/test routes, with authenticate + attachCustomerInfo
const reportDownloadRouter = routerModule.default;
const auth = await import('../../middlewares/auth.js');
const reportDownloadService = await import('../../services/reportDownload.service.js');

describe('Routes (report downloads): /sas-url/:month/:year, /customer, /debug', () => {
  let app;

  beforeEach(() => {
    authImpl = {
      authenticate: (req, res, next) => next(),
      attachCustomerInfo: (req, res, next) => { req.customer = { id: 'cust-123' }; next(); },
    };

    downloadImpl = {
      getReportSasUrl: (req, res, next) => res.status(200).json({ url: 'https://blob/sas-token' }),
      getAvailableReportsForCustomer: (req, res, next) => res.status(200).json([{ name: 'Oct-2025.pdf' }]),
      debugReports: (req, res, next) => res.status(200).json({ ok: true }),
      clearTestReports: (req, res, next) => res.status(200).json({ cleared: 5 }),
      createTestReport: (req, res, next) => res.status(200).json({ created: true }),
      createMultipleTestReports: (req, res, next) => res.status(200).json({ created: 3 }),
    };

    app = express();
    app.use(express.json());
    app.use('/report', reportDownloadRouter);

    app.use((err, req, res, next) => {
      const status = err?.status ?? 500;
      res.status(status).json({ name: err?.name ?? 'Error', message: err?.message ?? 'Unknown error' });
    });

    jest.clearAllMocks();
  });

  // ---- /sas-url/:month/:year ----
  test('GET /report/sas-url/:month/:year → 200 success', async () => {
    downloadImpl.getReportSasUrl = (req, res, next) =>
      res.status(200).json({ url: 'https://blob/sas?sig=abc', month: req.params.month, year: req.params.year });

    const res = await request(app).get('/report/sas-url/10/2025');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://blob/sas?sig=abc', month: '10', year: '2025' });
    expect(auth.authenticate).toHaveBeenCalledTimes(1);
    expect(auth.attachCustomerInfo).toHaveBeenCalledTimes(1);
    expect(reportDownloadService.getReportSasUrl).toHaveBeenCalledTimes(1);
  });

  test('GET /report/sas-url/:month/:year → 400 validation error (non-numeric)', async () => {
    downloadImpl.getReportSasUrl = (req, res, next) => {
      const { month, year } = req.params;
      if (!/^[0-9]+$/.test(month) || !/^[0-9]+$/.test(year)) {
        return next(Object.assign(new Error('`month` and `year` must be numeric'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json({ url: 'ok' });
    };

    const res = await request(app).get('/report/sas-url/Oct/2025');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: '`month` and `year` must be numeric' });
    expect(reportDownloadService.getReportSasUrl).toHaveBeenCalledTimes(1);
  });

  test('GET /report/sas-url/:month/:year → 503 service error via next()', async () => {
    downloadImpl.getReportSasUrl = (req, res, next) =>
      next(Object.assign(new Error('Blob storage unavailable'), { status: 503 }));

    const res = await request(app).get('/report/sas-url/10/2025');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Blob storage unavailable' });
  });

  // ---- /customer ----
  test('GET /report/customer → 200 success with data', async () => {
    downloadImpl.getAvailableReportsForCustomer = (req, res, next) =>
      res.status(200).json([{ name: 'Nov-2025.pdf' }, { name: 'Oct-2025.pdf' }]);

    const res = await request(app).get('/report/customer');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: 'Nov-2025.pdf' }, { name: 'Oct-2025.pdf' }]);
    expect(reportDownloadService.getAvailableReportsForCustomer).toHaveBeenCalledTimes(1);
  });

  test('GET /report/customer → 204 when empty', async () => {
    downloadImpl.getAvailableReportsForCustomer = (req, res, next) => res.status(204).send();

    const res = await request(app).get('/report/customer');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('GET /report/customer → 400 when req.customer missing', async () => {
    authImpl.attachCustomerInfo = (req, res, next) => next();

    downloadImpl.getAvailableReportsForCustomer = (req, res, next) => {
      if (!req.customer) {
        return next(Object.assign(new Error('Customer context is required'), { name: 'ValidationError', status: 400 }));
      }
      res.status(200).json([{ name: 'Sep-2025.pdf' }]);
    };

    const res = await request(app).get('/report/customer');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer context is required' });
  });

  // ---- /debug ----
  test('GET /report/debug → 200 success', async () => {
    downloadImpl.debugReports = (req, res, next) => res.status(200).json({ ok: true, items: 3 });

    const res = await request(app).get('/report/debug');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: 3 });
    expect(reportDownloadService.debugReports).toHaveBeenCalledTimes(1);
  });

  test('GET /report/debug → 503 service error via next()', async () => {
    downloadImpl.debugReports = (req, res, next) =>
      next(Object.assign(new Error('Debug service error'), { status: 503 }));

    const res = await request(app).get('/report/debug');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ name: 'Error', message: 'Debug service error' });
  });

  // ---- middleware errors ----
  test('Auth: 401 when authenticate blocks', async () => {
    authImpl.authenticate = (req, res, next) => res.status(401).json({ message: 'Unauthorized' });

    const res = await request(app).get('/report/customer');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(auth.attachCustomerInfo).not.toHaveBeenCalled();
    expect(reportDownloadService.getAvailableReportsForCustomer).not.toHaveBeenCalled();
  });

  test('Auth: 400 when attachCustomerInfo calls next(err)', async () => {
    authImpl.attachCustomerInfo = (req, res, next) =>
      next(Object.assign(new Error('Customer not found'), { name: 'ValidationError', status: 400 }));

    const res = await request(app).get('/report/customer');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ name: 'ValidationError', message: 'Customer not found' });
    expect(reportDownloadService.getAvailableReportsForCustomer).not.toHaveBeenCalled();
  });

  test('Middleware order: authenticate → attachCustomerInfo → handler', async () => {
    const sequence = [];
    authImpl.authenticate = (req, res, next) => { sequence.push('authenticate'); next(); };
    authImpl.attachCustomerInfo = (req, res, next) => { sequence.push('attachCustomerInfo'); req.customer = { id: 'cust-order' }; next(); };
    downloadImpl.getAvailableReportsForCustomer = (req, res, next) => { sequence.push('handler'); res.status(200).json([{ name: 'Aug-2025.pdf' }]); };

    const res = await request(app).get('/report/customer');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: 'Aug-2025.pdf' }]);
    expect(sequence).toEqual(['authenticate', 'attachCustomerInfo', 'handler']);
  });
});
