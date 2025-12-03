
// File: src/tests/server.test.js
import { jest } from '@jest/globals';

/**
 * server.js executes immediately on import (async IIFE).
 * All mocks MUST be registered BEFORE importing server.js.
 * We also stub process.exit to avoid killing the test runner.
 */
const importServer = async ({
  portEnv,                   // number|string; if undefined, delete to use fallback 5000
  connectDBImpl,             // () => Promise<any>
  connectReportsDBImpl,      // () => Promise<any>
  scheduleMonthlyReportImpl, // () => any (can throw to simulate failure)
} = {}) => {
  jest.resetModules();

  // ---- Stub process.exit so the test runner doesn't terminate ----
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

  // ---------- ENV ----------
  if (typeof portEnv === 'undefined') {
    delete process.env.PORT;
  } else {
    process.env.PORT = String(portEnv);
  }

  // ---------- Build absolute URLs relative to src/server.js ----------
  const serverURL = new URL('../server.js', import.meta.url);
  const appURL = new URL('./app.js', serverURL);
  const loggerURL = new URL('./config/logger.js', serverURL);
  const dbURL = new URL('./config/db.js', serverURL);
  const svcURL = new URL('./services/reportGenerator.service.js', serverURL);

  // ---------- dotenv ----------
  const dotenvConfigMock = jest.fn();
  await jest.unstable_mockModule('dotenv', () => ({
    default: { config: dotenvConfigMock },
    config: dotenvConfigMock,
  }));

  // ---------- logger ----------
  const infoMock = jest.fn();
  const errorMock = jest.fn();
  await jest.unstable_mockModule(loggerURL.href, () => ({
    default: { info: infoMock, error: errorMock },
    info: infoMock,
    error: errorMock,
  }));

  // ---------- app (express app) ----------
  // Express calls the listen callback synchronously.
  const listenMock = jest.fn((port, cb) => { if (typeof cb === 'function') cb(); });
  await jest.unstable_mockModule(appURL.href, () => ({
    default: { listen: listenMock },
  }));

  // ---------- DB connectors ----------
  const connectDBMock = jest.fn(connectDBImpl ?? (async () => {}));
  const connectReportsDBMock = jest.fn(connectReportsDBImpl ?? (async () => {}));

  await jest.unstable_mockModule(dbURL.href, () => ({
    connectDB: connectDBMock,
  }));

  // ---------- report service (covers static import & dynamic import) ----------
  const scheduleMonthlyReportMock = jest.fn(scheduleMonthlyReportImpl ?? (() => {}));
  await jest.unstable_mockModule(svcURL.href, () => ({
    connectReportsDB: connectReportsDBMock,
    scheduleMonthlyReport: scheduleMonthlyReportMock,
  }));

  // ---------- Import server (runs immediately) ----------
  await import(serverURL.href);

  // ---------- Wait a tick for async IIFE to complete (listen cb + dynamic import + schedule call) ----------
  await new Promise((resolve) => setImmediate(resolve));

  return {
    exitSpy,
    dotenvConfigMock,
    infoMock,
    errorMock,
    listenMock,
    connectDBMock,
    connectReportsDBMock,
    scheduleMonthlyReportMock,
  };
};

describe('src/server.js startup behavior', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.PORT;
  });

  test('calls dotenv.config() and uses PORT fallback = 5000 when env missing', async () => {
    const {
      exitSpy,
      dotenvConfigMock,
      connectDBMock,
      connectReportsDBMock,
      listenMock,
      infoMock,
      errorMock,
      scheduleMonthlyReportMock,
    } = await importServer({ portEnv: undefined });

    // dotenv.config called
    expect(dotenvConfigMock).toHaveBeenCalledTimes(1);

    // DB connectors invoked
    expect(connectDBMock).toHaveBeenCalledTimes(1);
    expect(connectReportsDBMock).toHaveBeenCalledTimes(1);

    // Server listen uses fallback port 5000 (number)
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledWith(5000, expect.any(Function));

    // Log messages
    expect(infoMock).toHaveBeenCalledWith('🔌 Connecting to main database...');
    expect(infoMock).toHaveBeenCalledWith('🔌 Connecting to reports database...');
    expect(infoMock).toHaveBeenCalledWith('🚀 Server running on port 5000');

    // No error logs on success; exit should not be called
    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    // Monthly report scheduled
    expect(scheduleMonthlyReportMock).toHaveBeenCalledTimes(1);

    exitSpy.mockRestore();
  });

  test('uses PORT from env when provided', async () => {
    const {
      exitSpy,
      listenMock,
      infoMock,
    } = await importServer({ portEnv: 8080 });

    // When PORT comes from env, it is a string
    expect(listenMock).toHaveBeenCalledWith('8080', expect.any(Function));
    expect(infoMock).toHaveBeenCalledWith('🚀 Server running on port 8080');
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test('fails when connectDB rejects: logs error and exits(1) and does NOT proceed', async () => {
    const error = new Error('connectDB failed');

    const {
      exitSpy,
      errorMock,
      infoMock,
      connectDBMock,
      connectReportsDBMock,
      listenMock,
    } = await importServer({
      connectDBImpl: async () => { throw error; },
      connectReportsDBImpl: async () => {},
    });

    // Error logged with exact tuple
    expect(errorMock).toHaveBeenCalledWith('❌ Server startup failed:', error);

    // Exit invoked
    expect(exitSpy).toHaveBeenCalledWith(1);

    // No further steps should occur
    expect(connectDBMock).toHaveBeenCalledTimes(1);
    expect(connectReportsDBMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();

    // Startup info logs should include only the first "main DB"
    expect(infoMock).toHaveBeenCalledWith('🔌 Connecting to main database...');
    // Should NOT include reports DB nor server running
    expect(infoMock).not.toHaveBeenCalledWith('🔌 Connecting to reports database...');
    expect(infoMock).not.toHaveBeenCalledWith(expect.stringContaining('Server running'));

    exitSpy.mockRestore();
  });

  test('fails when connectReportsDB rejects: logs error and exits(1) and does NOT listen', async () => {
    const error = new Error('connectReportsDB failed');

    const {
      exitSpy,
      errorMock,
      infoMock,
      connectDBMock,
      connectReportsDBMock,
      listenMock,
    } = await importServer({
      connectDBImpl: async () => {},
      connectReportsDBImpl: async () => { throw error; },
    });

    // Logs and exit
    expect(errorMock).toHaveBeenCalledWith('❌ Server startup failed:', error);
    expect(exitSpy).toHaveBeenCalledWith(1);

    // Steps: main DB succeeded, reports DB failed, no listen
    expect(connectDBMock).toHaveBeenCalledTimes(1);
    expect(connectReportsDBMock).toHaveBeenCalledTimes(1);
    expect(listenMock).not.toHaveBeenCalled();

    // Info logs include both connection attempts, but not server running
    expect(infoMock).toHaveBeenCalledWith('🔌 Connecting to main database...');
    expect(infoMock).toHaveBeenCalledWith('🔌 Connecting to reports database...');
    expect(infoMock).not.toHaveBeenCalledWith(expect.stringContaining('Server running'));

    exitSpy.mockRestore();
  });

  test('fails when scheduling throws: logs error and exits(1)', async () => {
    const error = new Error('dynamic import failed');

    const {
      exitSpy,
      errorMock,
    } = await importServer({
      scheduleMonthlyReportImpl: () => { throw error; },
    });

    expect(errorMock).toHaveBeenCalledWith('❌ Server startup failed:', error);
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  test('order: connectDB then connectReportsDB; listen only after both succeed', async () => {
    const {
      exitSpy,
      listenMock,
      connectDBMock,
      connectReportsDBMock,
    } = await importServer({
      connectDBImpl: async () => {},
      connectReportsDBImpl: async () => {},
    });

    // Verify both were called
    expect(connectDBMock).toHaveBeenCalledTimes(1);
    expect(connectReportsDBMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledTimes(1);

    // Invocation order: connectDB -> connectReportsDB -> listen
    const order_connectDB = connectDBMock.mock.invocationCallOrder[0];
    const order_connectReportsDB = connectReportsDBMock.mock.invocationCallOrder[0];
    const order_listen = listenMock.mock.invocationCallOrder[0];

    expect(order_connectDB).toBeLessThan(order_connectReportsDB);
    expect(order_connectReportsDB).toBeLessThan(order_listen);

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
