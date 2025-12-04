
import { jest } from '@jest/globals';
const { notFound } = await import('../../middlewares/notFound.js');

describe('notFound middleware', () => {
  test('should return 404 with correct message', () => {
    const req = { originalUrl: '/test-url' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    notFound(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not Found - /test-url',
    });
  });
});
