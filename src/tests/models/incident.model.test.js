
// File: src/tests/models/incident.model.test.js
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

// Import the model under test (ESM)
const { default: Incident } = await import('../../models/incident.model.js');

describe('Model: Incident (Mongoose schema validation)', () => {
  afterAll(async () => {
    // No DB connection is used, but calling disconnect() is safe
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('has correct schema options (collection, timestamps)', () => {
    const { options } = Incident.schema;
    expect(options.collection).toBe('orders');
    expect(options.timestamps).toBe(false);
  });

  test('declares expected indexes', () => {
    // Schema.indexes() returns [[fields, options], ...]
    const indexes = Incident.schema.indexes();

    // We expect two indexes:
    // 1) { customer_name: 1, status: 1 }
    // 2) { customer_name: 1, created_at: -1 }
    const fieldsOnly = indexes.map(([fields]) => fields);

    expect(fieldsOnly).toEqual(
      expect.arrayContaining([
        { customer_name: 1, status: 1 },
        { customer_name: 1, created_at: -1 },
      ])
    );
  });

  test('path types: _id is String; customer_name is required String; responder_id is Number', () => {
    const idPath = Incident.schema.path('_id');
    const customerNamePath = Incident.schema.path('customer_name');
    const responderPath = Incident.schema.path('responder_id');

    expect(idPath.instance).toBe('String');
    expect(customerNamePath.instance).toBe('String');
    expect(customerNamePath.options.required).toBe(true);

    expect(responderPath.instance).toBe('Number');
  });

  test('fails validation when required customer_name is missing', () => {
    const doc = new Incident({
      subject: 'Test subject',
      status: 1,
    });

    const error = doc.validateSync();
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors).toHaveProperty('customer_name');
    expect(error.errors.customer_name.kind).toBe('required');
  });

  test('fails validation when status is not a number', () => {
    const doc = new Incident({
      customer_name: 'Acme Corp',
      status: 'abc', // invalid
    });

    const error = doc.validateSync();
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    // Depending on Mongoose version, invalid types often show as a CastError under the path
    expect(error.errors).toHaveProperty('status');
    // We do a loose check for kind or name to be defensive across versions
    const statusErr = error.errors.status;
    expect(
      statusErr.kind === 'Number' ||
      statusErr.name === 'CastError' ||
      statusErr.kind === 'cast'
    ).toBe(true);
  });

  test('passes validation with minimal valid data', () => {
    const doc = new Incident({
      customer_name: 'Acme Corp',
      subject: 'Network alert',
      status: 2,
      priority: 'High',
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  test('allows optional string fields without errors', () => {
    const doc = new Incident({
      customer_name: 'Globex',
      subject: 'Email phishing',
      description: 'Suspicious email reported',
      priority: 'Medium',
      created_at: '2025-11-01T10:00:00Z',
      updated_at: '2025-11-02T10:00:00Z',
      soc_analysis: 'Analysis text',
      soc_recommendation: 'Recommendation text',
      incident_type: 'Phishing',
      incident_sub_status: 'Awaiting User',
      customer_escalation: 'Yes',
      agent_name: 'Analyst 1',
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  test('does not require _id (since _id is declared as String without required)', () => {
    const doc = new Incident({
      customer_name: 'Umbrella Corp',
      status: 1,
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
    // Note: saving without _id may fail depending on DB; we only test validation here.
  });
});
