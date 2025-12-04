
import { jest } from '@jest/globals';
const { errorHandler } = await import('../../middlewares/errorHandler.js');

describe('errorHandler middleware', () => {
  test('should return 401 for UnauthorizedError', () => {
    const err = { name: 'UnauthorizedError', message: 'Invalid token', code: 'invalid_token' };
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(err, req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('should return custom statusCode for ApiError', () => {
    const err = { statusCode: 400, message: 'Bad Request' };
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(err, req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 500 for unknown error', () => {
    const err = new Error('Unknown');
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(err, req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
