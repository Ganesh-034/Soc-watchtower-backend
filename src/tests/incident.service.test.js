import { jest } from '@jest/globals';
import Incident from '../models/incident.model.js';
import { getIncidentTickets } from '../services/incidentTicket.service.js';

// Mock the mongoose model
jest.mock('../models/incident.model.js');

describe('getIncidentTickets Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should throw an error if customer_name filter is missing', async () => {
    await expect(getIncidentTickets(0, 10, {})).rejects.toThrow(
      'Customer name filter is required for fetching tickets. This is a security violation.'
    );
  });

  test('should return tickets formatted correctly with valid customer_name', async () => {
    const filters = { customer_name: 'ACME' };

    // Mock countDocuments
    Incident.countDocuments.mockResolvedValue(1);

    // Mock find().sort().skip().limit().lean()
    const mockQueryChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: '123',
          subject: 'Test Subject',
          status: 2,
          priority: 'High',
          description: 'Some desc',
          created_at: '2024-01-01',
          updated_at: '2024-01-02',
          responder_id: 99,
          soc_analysis: 'Analysis',
          soc_recommendation: 'Recommendation',
          customer_name: 'ACME',
          sentinel_incident_number: 'INC001',
          ttps: 'T123',
          customer_sub_location: 'HQ',
          incident_type: 'Malware',
          incident_sub_status: 'Investigating',
          agent_name: 'Agent Smith',
          resolved_by: 'John',
          customer_escalation: 'Yes',
        },
      ]),
    };

    Incident.find.mockReturnValue(mockQueryChain);

    const result = await getIncidentTickets(0, 10, filters);

    expect(Incident.countDocuments).toHaveBeenCalledWith(filters);
    expect(Incident.find).toHaveBeenCalledWith(filters);
    expect(result.totalCount).toBe(1);
    expect(result.tickets.length).toBe(1);

    expect(result.tickets[0]).toEqual({
      id: '123',
      subject: 'Test Subject',
      status: 'Open',
      priority: 'High',
      socAnalysis: 'Analysis',
      socRecommendation: 'Recommendation',
      sentinelIncidentNumber: 'INC001',
      ttps: 'T123',
      description: 'Some desc',
      incidentType: 'Malware',
      incidentSubStatus: 'Investigating',
      createdDate: '2024-01-01',
      updatedDate: '2024-01-02',
      agentName: 'Agent Smith',
      customerName: 'ACME',
      customerId: 99,
      customerSubLocation: 'HQ',
      resolvedBy: 'John',
      customerEscalation: 'Yes',
    });
  });

  test('should apply correct sorting direction when created_at filter exists', async () => {
    const filters = { customer_name: 'ACME', created_at: '2024-01-01' };

    Incident.countDocuments.mockResolvedValue(0);

    const mockQueryChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };

    Incident.find.mockReturnValue(mockQueryChain);

    await getIncidentTickets(1, 20, filters); // page=1, limit=20

    expect(mockQueryChain.sort).toHaveBeenCalledWith({ created_at: 1 });
    expect(mockQueryChain.skip).toHaveBeenCalledWith(20); // skip = page * limit
    expect(mockQueryChain.limit).toHaveBeenCalledWith(20);
  });

  test('should default missing fields to NA', async () => {
    const filters = { customer_name: 'ACME' };

    Incident.countDocuments.mockResolvedValue(1);

    const mockQueryChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: null,
          subject: null,
          status: null,
          priority: null,
          description: null,
          created_at: null,
          updated_at: null,
          responder_id: null,
          soc_analysis: null,
          soc_recommendation: null,
          customer_name: 'ACME',
          sentinel_incident_number: null,
          ttps: null,
          customer_sub_location: null,
          incident_type: null,
          incident_sub_status: null,
          resolved_by: null,
          customer_escalation: null,
          agent_name: null,
        },
      ]),
    };

    Incident.find.mockReturnValue(mockQueryChain);

    const result = await getIncidentTickets(0, 10, filters);

    expect(result.tickets[0]).toEqual({
      id: 'NA',
      subject: 'NA',
      status: 'NA',
      priority: 'NA',
      socAnalysis: 'NA',
      socRecommendation: 'NA',
      sentinelIncidentNumber: 'NA',
      ttps: 'NA',
      description: 'NA',
      incidentType: 'NA',
      incidentSubStatus: 'NA',
      createdDate: 'NA',
      updatedDate: 'NA',
      agentName: 'NA',
      customerName: 'ACME',
      customerId: 'NA',
      customerSubLocation: 'NA',
      resolvedBy: 'NA',
      customerEscalation: 'NA',
    });
  });
});
