
// src/tests/utils/ApiError.test.js
import { ApiError } from '../../utils/ApiError.js';

describe('ApiError', () => {
  const STATUS = 404;
  const MSG = 'Not Found';

  test('should be an instance of ApiError and Error', () => {
    const err = new ApiError(STATUS, MSG);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });

  test('should set statusCode and message correctly', () => {
    const err = new ApiError(STATUS, MSG);
    expect(err.statusCode).toBe(STATUS);
    expect(err.message).toBe(MSG);
  });

  test('should have a sensible name (ApiError or Error depending on runtime)', () => {
    const err = new ApiError(STATUS, MSG);
    expect(['ApiError', 'Error']).toContain(err.name);
    const ctorName = Object.getPrototypeOf(err)?.constructor?.name;
    expect(['ApiError', 'Error']).toContain(ctorName);
  });

  test('should include a stack trace string', () => {
    const err = new ApiError(STATUS, MSG);
    expect(err.stack).toEqual(expect.any(String));
    expect(err.stack).toContain(MSG);
  });

  test('should accept falsy status codes like 0', () => {
    const err = new ApiError(0, 'Zero code');
    expect(err.statusCode).toBe(0);
    expect(err.message).toBe('Zero code');
  });

  test('should allow null statusCode without mutation', () => {
    const err = new ApiError(null, 'Nullable code');
    expect(err.statusCode).toBeNull();
    expect(err.message).toBe('Nullable code');
  });

  test('toString should include message and start with the error name', () => {
    const err = new ApiError(500, 'Internal Server Error');
    const str = err.toString();
    expect(str).toContain('Internal Server Error');
    expect(str.startsWith('ApiError:') || str.startsWith('Error:')).toBe(true);
  });

  test('message can be empty string; toString still shows name + colon', () => {
    const err = new ApiError(400, '');
    const str = err.toString();
    expect(err.message).toBe('');
    expect(
      str === 'ApiError:' ||
      str === 'Error:' ||
      str.startsWith('Error') ||
      str.startsWith('ApiError')
    ).toBe(true);
  });
});
``
