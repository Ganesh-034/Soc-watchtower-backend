
import { jest } from '@jest/globals';
const { requestLogger } = await import('../../middlewares/requestLogger.js');

describe('requestLogger middleware', () => {
  test('should log method and URL and call next()', () => {
    const req = { method: 'GET', originalUrl: '/test-url' };
    const res = {};
    const next = jest.fn();

    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    requestLogger(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('GET /test-url');
    expect(next).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle missing method or URL gracefully', () => {
    const req = {}; // Missing method and URL
    const res = {};
    const next = jest.fn();

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    requestLogger(req, res, next);

    // It should log "undefined undefined"
    expect(consoleSpy).toHaveBeenCalledWith('undefined undefined');
    expect(next).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
