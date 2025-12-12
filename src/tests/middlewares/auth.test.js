
import { jest } from '@jest/globals';
import { ApiError } from '../../utils/ApiError.js';

// Mock dotenv to avoid process.exit during tests
jest.unstable_mockModule('dotenv', () => ({
  default: { config: jest.fn() },
}));

// Mock express-jwt and jwks-rsa
jest.unstable_mockModule('express-jwt', () => ({
  expressjwt: jest.fn(() => (req, res, next) => next()),
}));
jest.unstable_mockModule('jwks-rsa', () => ({
  expressJwtSecret: jest.fn(() => 'mock-secret'),
}));

const { authenticate, attachCustomerInfo } = await import('../../middlewares/auth.js');

describe('auth middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('authenticate should call next() for valid token', () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('attachCustomerInfo should throw 401 if req.auth is missing', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    await expect(attachCustomerInfo(req, res, next)).rejects.toThrow(ApiError);
  });

  test('attachCustomerInfo should throw 403 if customer_name is missing', async () => {
    const req = { auth: {} };
    const res = {};
    const next = jest.fn();
    await expect(attachCustomerInfo(req, res, next)).rejects.toThrow(ApiError);
  });

  test('attachCustomerInfo should attach customerName and call next()', async () => {
    const req = { auth: { customer_name: 'ACME' } };
    const res = {};
    const next = jest.fn();
    await attachCustomerInfo(req, res, next);
    expect(req.customerName).toBe('ACME');
    expect(next).toHaveBeenCalled();
  });
});
