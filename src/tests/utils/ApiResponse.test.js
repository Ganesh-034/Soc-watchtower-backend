
// src/tests/utils/ApiResponse.test.js
import { ApiResponse } from '../../utils/ApiResponse.js';

describe('ApiResponse', () => {
  test('should be an instance of ApiResponse', () => {
    const res = new ApiResponse(200, { ok: true }, 'All good');
    expect(res).toBeInstanceOf(ApiResponse);
  });

  test('should set statusCode, data, and message correctly', () => {
    const payload = { id: 1, name: 'Alice' };
    const res = new ApiResponse(201, payload, 'Created');
    expect(res.statusCode).toBe(201);
    expect(res.data).toBe(payload);
    expect(res.message).toBe('Created');
  });

  test('should default message to "Success" when not provided', () => {
    const res = new ApiResponse(200, { ok: true });
    expect(res.message).toBe('Success');
  });

  test('success should be true when statusCode < 400', () => {
    expect(new ApiResponse(200, null).success).toBe(true);
    expect(new ApiResponse(0, null).success).toBe(true);
    expect(new ApiResponse(399, null).success).toBe(true);
  });

  test('success should be false when statusCode >= 400', () => {
    expect(new ApiResponse(400, null).success).toBe(false);
    expect(new ApiResponse(500, null).success).toBe(false);
    expect(new ApiResponse(999, null).success).toBe(false);
  });

  test('data can be null or any value', () => {
    const resNull = new ApiResponse(200, null);
    expect(resNull.data).toBeNull();

    const resArray = new ApiResponse(200, [1, 2, 3]);
    expect(resArray.data).toEqual([1, 2, 3]);

    const resPrimitive = new ApiResponse(200, 'hello');
    expect(resPrimitive.data).toBe('hello');
  });

  test('object structure should be serializable to JSON', () => {
    const res = new ApiResponse(201, { created: true }, 'Created');
    const json = JSON.parse(JSON.stringify(res));
    expect(json).toEqual({
      statusCode: 201,
      data: { created: true },
      message: 'Created',
      success: true,
    });
  });

  test('boundary statuses: 399 => success, 400 => failure', () => {
    expect(new ApiResponse(399, {}).success).toBe(true);
    expect(new ApiResponse(400, {}).success).toBe(false);
  });

  test('works with empty message explicitly provided', () => {
    const res = new ApiResponse(200, {}, '');
    expect(res.message).toBe('');
    expect(res.success).toBe(true);
  });
});
