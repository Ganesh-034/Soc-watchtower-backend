
// File: src/tests/config/logger.test.js
import { jest } from '@jest/globals';

/**
 * Loads the logger module with a fresh ESM import and preconfigured mocks.
 * This ensures the createLogger mock's return value is set BEFORE the module under test is evaluated.
 */
const loadLoggerModule = async ({ fakeLogger } = {}) => {
  jest.resetModules();

  // Provide a concrete logger instance the module should export
  const loggerInstance = fakeLogger ?? { info: jest.fn(), error: jest.fn() };

  // Define mocks for winston API pieces used by the module
  const timestampMock = jest.fn().mockReturnValue('TIMESTAMP_FORMAT');
  const printfMock = jest.fn((fmtFn) => 'PRINTF_FORMAT'); // should receive a function
  const combineMock = jest.fn(() => 'COMBINED_FORMAT');

  // Console must be constructible via `new`
  function Console() {} // a real constructor function
  const ConsoleMock = jest.fn(Console);

  // createLogger must return our logger instance at import-time
  const createLoggerMock = jest.fn().mockReturnValue(loggerInstance);

  // Mock 'winston' BEFORE importing the module under test
  await jest.unstable_mockModule('winston', () => ({
    default: {
      createLogger: createLoggerMock,
      format: {
        combine: combineMock,
        timestamp: timestampMock,
        printf: printfMock,
      },
      transports: { Console: ConsoleMock },
    },
    // also expose named exports to be safe
    createLogger: createLoggerMock,
    format: {
      combine: combineMock,
      timestamp: timestampMock,
      printf: printfMock,
    },
    transports: { Console: ConsoleMock },
  }));

  // Now import the module under test
  const moduleSpecifier = new URL('../../config/logger.js', import.meta.url).href;
  const loggerModule = await import(moduleSpecifier);

  return {
    loggerModule,
    createLoggerMock,
    timestampMock,
    printfMock,
    combineMock,
    transports: { Console: ConsoleMock },
    loggerInstance,
  };
};

describe('src/config/logger.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('creates logger with correct configuration and exports the instance', async () => {
    const {
      loggerModule,
      createLoggerMock,
      timestampMock,
      printfMock,
      combineMock,
      transports,
      loggerInstance,
    } = await loadLoggerModule();

    // createLogger should be called once at module import-time
    expect(createLoggerMock).toHaveBeenCalledTimes(1);

    // Inspect the config passed to createLogger
    const configArg = createLoggerMock.mock.calls[0][0];
    expect(configArg.level).toBe('info');

    // Verify format wiring
    expect(timestampMock).toHaveBeenCalledTimes(1);
    expect(printfMock).toHaveBeenCalledTimes(1);
    const printfArgFn = printfMock.mock.calls[0][0];
    expect(typeof printfArgFn).toBe('function'); // printf receives a formatter function

    expect(combineMock).toHaveBeenCalledTimes(1);
    expect(combineMock).toHaveBeenCalledWith('TIMESTAMP_FORMAT', 'PRINTF_FORMAT');
    expect(configArg.format).toBe('COMBINED_FORMAT');

    // Verify transport: one Console instance constructed via `new`
    expect(configArg.transports).toHaveLength(1);
    expect(configArg.transports[0]).toBeInstanceOf(transports.Console);
    expect(transports.Console).toHaveBeenCalledTimes(1);

    // Default export should be the logger instance returned by createLogger
    const { default: logger } = loggerModule;
    expect(logger).toBe(loggerInstance);
  });

  test('logger.info and logger.error forward to the underlying instance', async () => {
    const fakeLogger = { info: jest.fn(), error: jest.fn() };
    const { loggerModule } = await loadLoggerModule({ fakeLogger });

    const { default: logger } = loggerModule;

    // These calls should not throw and should hit the underlying methods
    logger.info('Test info message');
    logger.error('Test error message');

    expect(fakeLogger.info).toHaveBeenCalledWith('Test info message');
    expect(fakeLogger.error).toHaveBeenCalledWith('Test error message');
  });
});
