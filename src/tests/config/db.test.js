
// File: src/tests/config/db.test.js
// ESM Jest tests for src/config/db.js
import { jest } from '@jest/globals';

// Helper to (re)load the module under test with fresh mocks and environment
const loadConnectDB = async ({
  uri,
  dbName,
  connResult,      // if provided, resolve connect with this object
  connError,       // if provided, reject connect with this error
} = {}) => {
  // Ensure a clean module registry for each test run
  jest.resetModules();

  // Prepare environment variables for this run
  if (typeof uri === 'undefined') {
    delete process.env.MONGODB_URI;
  } else {
    process.env.MONGODB_URI = uri;
  }
  if (typeof dbName === 'undefined') {
    delete process.env.MONGODB_DB_NAME;
  } else {
    process.env.MONGODB_DB_NAME = dbName;
  }

  // Fresh mocks for mongoose and logger per import cycle
  const mongooseMock = {
    connect: jest.fn(),
  };

  if (connError) {
    mongooseMock.connect.mockRejectedValue(connError);
  } else {
    // Default successful connection shape unless caller specifies a custom connResult
    mongooseMock.connect.mockResolvedValue(
      connResult ?? { connection: { host: 'localhost' } }
    );
  }

  const infoMock = jest.fn();
  const errorMock = jest.fn();

  // Mock the external dependencies BEFORE importing the module under test
  // 1) Mock 'mongoose' package
  await jest.unstable_mockModule('mongoose', () => ({
    default: mongooseMock,
    // Provide a named export too, just in case the test environment attempts any named resolution
    connect: mongooseMock.connect,
  }));

  // 2) Mock local logger (src/config/logger.js)
  const loggerModuleSpecifier = new URL('../../config/logger.js', import.meta.url).href;
  await jest.unstable_mockModule(loggerModuleSpecifier, () => ({
    default: { info: infoMock, error: errorMock },
    info: infoMock,
    error: errorMock,
  }));

  // Now import the module under test (ESM dynamic import after mocks are in place)
  const dbModuleSpecifier = new URL('../../config/db.js', import.meta.url).href;
  const { connectDB } = await import(dbModuleSpecifier);

  return {
    connectDB,
    mongooseMock,
    infoMock,
    errorMock,
  };
};

describe('src/config/db.js → connectDB', () => {
  afterEach(() => {
    // Clean up env vars & mocks after each test
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    jest.clearAllMocks();
  });

  test('skips connection when MONGODB_URI is missing and logs info', async () => {
    const { connectDB, mongooseMock, infoMock, errorMock } = await loadConnectDB({
      uri: undefined, // simulate missing env
    });

    const result = await connectDB();

    // Should not attempt to connect
    expect(mongooseMock.connect).not.toHaveBeenCalled();

    // Should log the skip message
    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(
      'Database connection skipped (MongoDB not configured yet).'
    );

    // No error logging
    expect(errorMock).not.toHaveBeenCalled();

    // Return value should be undefined
    expect(result).toBeUndefined();
  });

  test('successful connection logs host and returns the connection object', async () => {
    const uri = 'mongodb://localhost:27017';
    const dbName = 'mydb';
    const fakeConn = { connection: { host: '127.0.0.1' } };

    const { connectDB, mongooseMock, infoMock, errorMock } = await loadConnectDB({
      uri,
      dbName,
      connResult: fakeConn,
    });

    const result = await connectDB();

    // Verify connect was called with correct URI and options
    expect(mongooseMock.connect).toHaveBeenCalledTimes(1);
    expect(mongooseMock.connect).toHaveBeenCalledWith(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName,
    });

    // Info log contains resolved host
    expect(infoMock).toHaveBeenCalledWith('MongoDB Connected: 127.0.0.1');

    // No error logging
    expect(errorMock).not.toHaveBeenCalled();

    // Function should return the underlying connection result
    expect(result).toBe(fakeConn);
  });

  test('passes undefined dbName when MONGODB_DB_NAME is not set', async () => {
    const uri = 'mongodb://localhost:27017';

    const { connectDB, mongooseMock, infoMock } = await loadConnectDB({
      uri,
      dbName: undefined,
      connResult: { connection: { host: 'localhost' } },
    });

    await connectDB();

    // Options must include dbName: undefined
    expect(mongooseMock.connect).toHaveBeenCalledWith(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: undefined,
    });

    // Info log still emitted with host
    expect(infoMock).toHaveBeenCalledWith('MongoDB Connected: localhost');
  });

  test('handles rejected connection: logs error and calls process.exit(1)', async () => {
    const uri = 'mongodb://localhost:27017';
    const err = new Error('boom');

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { /* no-op in tests */ });

    const { connectDB, mongooseMock, errorMock, infoMock } = await loadConnectDB({
      uri,
      dbName: 'mydb',
      connError: err,
    });

    // Should not throw; it will call process.exit(1)
    await connectDB();

    // Verify attempt to connect was made
    expect(mongooseMock.connect).toHaveBeenCalledTimes(1);

    // Error log includes error.message
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith('Error connecting to MongoDB: boom');

    // No info log on failure
    expect(infoMock).not.toHaveBeenCalled();

    // Process exit should be invoked with status 1
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  test('does not crash if conn.connection.host is missing; logs "undefined"', async () => {
    const uri = 'mongodb://localhost:27017';
    const dbName = 'mydb';
    const connWithoutHost = { connection: {} };

    const { connectDB, infoMock } = await loadConnectDB({
      uri,
      dbName,
      connResult: connWithoutHost,
    });

    const result = await connectDB();

    // Log should show "undefined"
    expect(infoMock).toHaveBeenCalledWith('MongoDB Connected: undefined');

    // Return value should still be the raw connection object
    expect(result).toBe(connWithoutHost);
  });
});
