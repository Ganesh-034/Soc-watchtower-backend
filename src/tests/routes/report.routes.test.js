
// File: src/tests/routes/report.routes.test.js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// --- Mutable service implementations swapped per-test (these are NOT Express handlers) ---
let reportServiceImpl = {
  checkReportsDBHealth: async () => ({ status: 'healthy', details: { pingMs: 42 } }),
  generateMonthlyReport: async () => '/tmp/reports/monthly-2025-10.pdf',
  getReportData: async () => ({ title: 'Monthly Report', items: [{ id: 1 }] }),
  generateLast5MonthsReports: async () => [
    { month: '07-2025', ok: true },
    { month: '08-2025', ok: true },
    { month: '09-2025', ok: true },
    { month: '10-2025', ok: true },
    { month: '11-2025', ok: true },
  ],
};

// --- ejs default export mock (object with renderFile) ---
let ejsImpl = {
  renderFile: async (tplPath, data) => `<html><h1>${data.title}</h1></html>`,
};

// --- logger default export mock ---
const loggerMock = { error: jest.fn() };

// --- Mock modules ---
jest.unstable_mockModule('../../services/reportGenerator.service.js', () => ({
  checkReportsDBHealth: jest.fn(() => reportServiceImpl.checkReportsDBHealth()),
  generateMonthlyReport: jest.fn(() => reportServiceImpl.generateMonthlyReport()),
  getReportData: jest.fn(() => reportServiceImpl.getReportData()),
  generateLast5MonthsReports: jest.fn(() => reportServiceImpl.generateLast5MonthsReports()),
}));

// EJS is imported as a default object in your router: `import ejs from "ejs";`
// We’ll return a default object with a renderFile method to match that.
jest.unstable_mockModule('ejs', () => ({
  default: {
    renderFile: jest.fn((...args) => ejsImpl.renderFile(...args)),
  },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: loggerMock,
}));

// --- Import router AFTER mocks ---
const routerModule = await import('../../routes/report.routes.js'); // health, generate-report, view-report, generate/last5months
const reportRouter = routerModule.default;

const reportService = await import('../../services/reportGenerator.service.js');
const ejsModule = await import('ejs');
const logger = await import('../../config/logger.js');

describe('Routes (reports core): /health, /generate-report, /view-report, /generate/last5months', () => {
  let app;

  beforeEach(() => {
    // Reset implementations before each test
    reportServiceImpl = {
      checkReportsDBHealth: async () => ({ status: 'healthy', details: { pingMs: 42 } }),
      generateMonthlyReport: async () => '/tmp/reports/monthly-2025-10.pdf',
      getReportData: async () => ({ title: 'Monthly Report', items: [{ id: 1 }] }),
      generateLast5MonthsReports: async () => [
        { month: '07-2025', ok: true },
        { month: '08-2025', ok: true },
        { month: '09-2025', ok: true },
        { month: '10-2025', ok: true },
        { month: '11-2025', ok: true },
      ],
    };

    ejsImpl = {
      renderFile: async (tplPath, data) => `<html><h1>${data.title}</h1></html>`,
    };

    loggerMock.error.mockReset();

    app = express();
    app.use(express.json());
    app.use('/report', reportRouter);

    jest.clearAllMocks();
  });

  // ---- /health ----
  test('GET /report/health → 200 when healthy', async () => {
    reportServiceImpl.checkReportsDBHealth = async () => ({ status: 'healthy', details: { pingMs: 33 } });

    const res = await request(app).get('/report/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'healthy', details: { pingMs: 33 } });
    expect(reportService.checkReportsDBHealth).toHaveBeenCalledTimes(1);
  });

  test('GET /report/health → 503 when unhealthy', async () => {
    reportServiceImpl.checkReportsDBHealth = async () => ({ status: 'unhealthy', reason: 'lag' });

    const res = await request(app).get('/report/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unhealthy', reason: 'lag' });
  });

  test('GET /report/health → 503 when service throws', async () => {
    reportServiceImpl.checkReportsDBHealth = async () => {
      throw new Error('connection refused');
    };

    const res = await request(app).get('/report/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'unhealthy',
      message: 'Reports database health check error: connection refused',
    });
  });

  // ---- /generate-report ----
  test('GET /report/generate-report → 200 text success', async () => {
    reportServiceImpl.generateMonthlyReport = async () => '/tmp/reports/monthly-2025-11.pdf';

    const res = await request(app).get('/report/generate-report');

    expect(res.status).toBe(200);
    expect(res.text).toBe('Report generated successfully: /tmp/reports/monthly-2025-11.pdf');
    expect(reportService.generateMonthlyReport).toHaveBeenCalledTimes(1);
  });

  test('GET /report/generate-report → 500 on error (logger.error called)', async () => {
    reportServiceImpl.generateMonthlyReport = async () => {
      throw new Error('disk full');
    };

    const res = await request(app).get('/report/generate-report');

    expect(res.status).toBe(500);
    expect(res.text).toBe('Error generating report: disk full');
    expect(logger.default.error).toHaveBeenCalledTimes(1);
  });

  // ---- /view-report ----
  test('GET /report/view-report → 200 renders HTML via EJS', async () => {
    reportServiceImpl.getReportData = async () => ({ title: 'KPI Report', items: [{ id: 99 }] });
    ejsImpl.renderFile = async (tplPath, data) => `<html><body><h2>${data.title}</h2></body></html>`;

    const res = await request(app).get('/report/view-report');

    expect(res.status).toBe(200);
    expect(res.text).toBe('<html><body><h2>KPI Report</h2></body></html>');
    expect(reportService.getReportData).toHaveBeenCalledTimes(1);
    expect(ejsModule.default.renderFile).toHaveBeenCalledTimes(1);
  });

  test('GET /report/view-report → 500 when EJS render fails (logger.error called)', async () => {
    ejsImpl.renderFile = async () => {
      throw new Error('template missing');
    };

    const res = await request(app).get('/report/view-report');

    expect(res.status).toBe(500);
    expect(res.text).toBe('Error rendering report: template missing');
    expect(logger.default.error).toHaveBeenCalledTimes(1);
  });

  test('GET /report/view-report → 500 when data fetch fails (logger.error called)', async () => {
    reportServiceImpl.getReportData = async () => {
      throw new Error('API timeout');
    };

    const res = await request(app).get('/report/view-report');

    expect(res.status).toBe(500);
    expect(res.text).toBe('Error rendering report: API timeout');
    expect(logger.default.error).toHaveBeenCalledTimes(1);
  });

  // ---- POST /generate/last5months ----
  test('POST /report/generate/last5months → 200 success with JSON', async () => {
    reportServiceImpl.generateLast5MonthsReports = async () => [{ month: '07-2025', ok: true }];

    const res = await request(app).post('/report/generate/last5months');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Last 5 months report generation completed',
      results: [{ month: '07-2025', ok: true }],
    });
    expect(reportService.generateLast5MonthsReports).toHaveBeenCalledTimes(1);
  });

  test('POST /report/generate/last5months → 500 on error (logger.error called)', async () => {
    reportServiceImpl.generateLast5MonthsReports = async () => {
      throw new Error('batch failed');
    };

    const res = await request(app).post('/report/generate/last5months');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to generate last 5 months reports' });
    expect(logger.default.error).toHaveBeenCalledTimes(1);
  });
});
