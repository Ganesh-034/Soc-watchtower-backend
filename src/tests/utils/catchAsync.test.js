
// src/tests/utils/catchAsync.integration.test.js
import express from 'express';
import request from 'supertest';
import catchAsync from '../../utils/catchAsync.js';

describe('catchAsync integration', () => {
  test('propagates async errors to error handler', async () => {
    const app = express();

    app.get(
      '/boom',
      catchAsync(async (req, res) => {
        throw new Error('boom');
      })
    );

    // Express error handler
    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message });
    });

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'boom' });
  });

  test('successful handler flows without error', async () => {
    const app = express();

    app.get(
      '/ok',
      catchAsync(async (req, res) => {
        res.json({ status: 'ok' });
      })
    );

    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
