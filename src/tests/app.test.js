
// File: src/tests/app.test.js
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

/**
 * Helper to set up mocks and import the app fresh each time.
 * We DO NOT mock 'cors' to preserve real CORS behavior.
 */
const loadApp = async () => {
  jest.resetModules();

  // Shared mutable counters object so we can observe increments after requests
  const counters = { helmet: 0, compression: 0, morgan: 0 };

  // --- Mock helmet, compression, morgan as pass-through middlewares with counters ---
  await jest.unstable_mockModule('helmet', () => ({
    default: () => (req, res, next) => { counters.helmet += 1; next(); },
  }));

  let morganMock;
  await jest.unstable_mockModule('morgan', () => ({
    default: (morganMock = jest.fn(() => (req, res, next) => { counters.morgan += 1; next(); })),
  }));

  await jest.unstable_mockModule('compression', () => ({
    default: () => (req, res, next) => { counters.compression += 1; next(); },
  }));

  // --- Mock error and notFound middlewares ---
  const errorHandler = (err, req, res, next) => {
    // Minimal JSON error response for assertions
    res.status(500).json({ error: err?.message ?? 'Internal Server Error' });
  };

  const notFound = (req, res, next) => {
    res.status(404).json({ error: 'Route not found' });
  };

  const errorHandlerMod = new URL('../middlewares/errorHandler.js', import.meta.url).href;
  await jest.unstable_mockModule(errorHandlerMod, () => ({
    errorHandler,
  }));

  const notFoundMod = new URL('../middlewares/notFound.js', import.meta.url).href;
  await jest.unstable_mockModule(notFoundMod, () => ({
    notFound,
  }));

  // --- Build minimal routers to validate mounting and CORS behavior ---
  const mkRouter = (pathBase = '/') => {
    const r = express.Router();
    // simple GET endpoint
    r.get('/ping', (req, res) => res.status(200).json({ ok: true, base: pathBase }));
    return r;
  };

  const incidentRoutes = mkRouter('/api');
  const incidentTicketRoutes = mkRouter('/api');
  const incidentSeverityRoutes = mkRouter('/api');
  const incidentDSRoutes = mkRouter('/api');
  const incidentViewRoutes = mkRouter('/api');
  const incidentHSRoutes = mkRouter('/api');
  const incidentSSRoutes = mkRouter('/api');
  const reportRoutes = mkRouter('/api/reports');
  const incidentTicketReportRoutes = mkRouter('/api');
  const reportDownloadRoutes = mkRouter('/api/reports');

  // Register each routes module mock
  const routesBase = new URL('../routes/', import.meta.url).href;

  await jest.unstable_mockModule(new URL('./incident.routes.js', routesBase).href, () => ({
    default: incidentRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incidentTicket.routes.js', routesBase).href, () => ({
    default: incidentTicketRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incident.severity.routes.js', routesBase).href, () => ({
    default: incidentSeverityRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incidentDS.routes.js', routesBase).href, () => ({
    default: incidentDSRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incidentView.routes.js', routesBase).href, () => ({
    default: incidentViewRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incidentHS.routes.js', routesBase).href, () => ({
    default: incidentHSRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incidentSS.routes.js', routesBase).href, () => ({
    default: incidentSSRoutes,
  }));
  await jest.unstable_mockModule(new URL('./report.routes.js', routesBase).href, () => ({
    default: reportRoutes,
  }));
  await jest.unstable_mockModule(new URL('./incidentTicketReport.routes.js', routesBase).href, () => ({
    default: incidentTicketReportRoutes,
  }));
  await jest.unstable_mockModule(new URL('./reportDownload.routes.js', routesBase).href, () => ({
    default: reportDownloadRoutes,
  }));

  // Finally import the app AFTER all mocks are in place
  const appModule = await import(new URL('../app.js', import.meta.url).href);
  const app = appModule.default;

  return {
    app,
    counters,
    morganMock,
  };
};

describe('src/app.js', () => {
  const allowedOrigins = [
    'https://www.soc-watchtower.com',
    'https://soc-watchtower.com',
  ];

  test('ETag is disabled', async () => {
    const { app } = await loadApp();
    expect(app.get('etag')).toBe(false);
  });

  test('CORS allows requests with allowed Origin header and sets credentials', async () => {
    const { app } = await loadApp();

    const res = await request(app)
      .get('/api/ping')
      .set('Origin', allowedOrigins[0])
      .expect(200);

    // CORS should reflect the Origin and set credentials
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigins[0]);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.body).toEqual({ ok: true, base: '/api' });
  });

  test('CORS allows requests with no Origin header (e.g., Postman/curl)', async () => {
    const { app } = await loadApp();

    const res = await request(app)
      .get('/api/ping')
      // no Origin header
      .expect(200);

    // No CORS headers are required here, but the request should succeed
    expect(res.body).toEqual({ ok: true, base: '/api' });
  });

  test('CORS blocks disallowed Origin and propagates error to errorHandler', async () => {
    const { app } = await loadApp();

    const res = await request(app)
      .get('/api/ping')
      .set('Origin', 'https://evil.example.com')
      .expect(500);

    // Our mocked errorHandler should return the CORS error message
    expect(res.body).toEqual({ error: 'Not allowed by CORS' });
  });

  test('CORS preflight (OPTIONS) to allowed origin returns 204 with empty body', async () => {
    const { app } = await loadApp();

    const res = await request(app)
      .options('/api/ping')
      .set('Origin', allowedOrigins[1])
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    // Body should be empty object in supertest
    expect(res.body).toEqual({});
  });

  test('Routers are mounted at /api, /api/incidents, and /api/reports', async () => {
    const { app } = await loadApp();

    await request(app).get('/api/ping').expect(200);
    await request(app).get('/api/incidents/ping').expect(200);
    await request(app).get('/api/reports/ping').expect(200);
  });

  test('Unknown route hits notFound and returns 404', async () => {
    const { app } = await loadApp();

    const res = await request(app)
      .get('/this-route-does-not-exist')
      .expect(404);

    expect(res.body).toEqual({ error: 'Route not found' });
  });

  test('helmet, compression, and morgan middlewares run during requests', async () => {
    const { app, counters, morganMock } = await loadApp();

    // Make two requests to ensure multiple invocations across pipeline
    await request(app).get('/api/ping').expect(200);
    await request(app).get('/api/ping').expect(200);

    // Assert morgan was configured with 'dev'
    expect(morganMock).toHaveBeenCalledTimes(1);
    expect(morganMock).toHaveBeenCalledWith('dev');

    // Middlewares should have been invoked at least once per request
    expect(counters.helmet).toBeGreaterThanOrEqual(2);
    expect(counters.compression).toBeGreaterThanOrEqual(2);
    expect(counters.morgan).toBeGreaterThanOrEqual(2);
  });
});
