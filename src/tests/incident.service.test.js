
import { jest } from '@jest/globals';

// ✅ Mock the Mongoose model before importing the service
jest.unstable_mockModule('../models/incident.model.js', () => ({
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

// Import after mocking
const Incident = (await import('../models/incident.model.js')).default;
const { getIncidentTickets } = await import('../services/incidentTicket.service.js');

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
    Incident.countDocuments.mockResolvedValue(1);

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
    expect(result.tickets[0].status).toBe('Open');
  });
});
