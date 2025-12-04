
// src/tests/utils/asyncHandler.test.js
import asyncHandler from '../../utils/asyncHandler.js';

describe('asyncHandler', () => {
  const makeReqResNext = () => {
    const req = { path: '/test' };
    const res = {};
    const next = jest.fn();
    return { req, res, next };
  };

  const flush = () => new Promise((r) => setImmediate(r));

  test('passes req, res, next', async () => {
    const inner = jest.fn();
    const mw = asyncHandler(inner);
    const { req, res, next } = makeReqResNext();

    mw(req, res, next);
    await flush();

    expect(inner).toHaveBeenCalledWith(req, res, next);
  });

  test('calls next on async throw', async () => {
    const err = new Error('boom');
    const inner = jest.fn(async () => { throw err; });
    const mw = asyncHandler(inner);
    const { req, res, next } = makeReqResNext();

    mw(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(err);
  });

  test('calls next on sync throw', async () => {
    const err = new Error('sync boom');
    const inner = jest.fn(() => { throw err; });
    const mw = asyncHandler(inner);
    const { req, res, next } = makeReqResNext();

    mw(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(err);
  });

  test('does not call next on success', async () => {
    const inner = jest.fn(async () => 'ok');
    const mw = asyncHandler(inner);
    const { req, res, next } = makeReqResNext();

    mw(req, res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
  });
});
