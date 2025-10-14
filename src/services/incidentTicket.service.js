// import Incident from '../models/incident.model.js';

// export const getIncidentTickets = async (page = 0, limit = 10, filters = {}) => {
//   try {
//     const skip = page * limit;
    
//     // Get total count for pagination
//     const totalCount = await Incident.countDocuments(filters);
    
//     // Get paginated data
//     const tickets = await Incident.find(filters)
//       .sort({ created_at: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();
    
//     // Format data to match frontend expectations
//     const formattedTickets = tickets.map(ticket => ({
//       id: ticket._id,
//       subject: ticket.subject,
//       status: mapStatus(ticket.status), // Convert numeric status to string
//       priority: ticket.priority,
//       socAnalysis: ticket.soc_analysis,
//       socRecommendation: ticket.soc_recommendation,
//       sentinelIncidentNumber: ticket.sentinel_incident_number,
//       ttps: ticket.ttps,
//       description: ticket.description,
//       incidentType: ticket.incident_type,
//       incidentSubStatus: ticket.incident_sub_status,
//       createdDate: ticket.created_at,
//       updatedDate: ticket.updated_at,
//       agentName: ticket.agent_name,
//       customerName: ticket.customer_name
//     }));
    
//     return {
//       tickets: formattedTickets,
//       totalCount,
//       page,
//       limit
//     };
//   } catch (error) {
//     console.error('Error in getIncidentTickets:', error);
//     throw new Error('Error fetching incident tickets: ' + error.message);
//   }
// };

// // Helper function to map numeric status to string
// function mapStatus(statusCode) {
//   const statusMap = {
//     2: 'Open',
//     5: 'Closed',
//     3: 'In Progress'
//   };
//   return statusMap[statusCode] || 'Unknown';
// }







// import Incident from '../models/incident.model.js';

// export const getIncidentTickets = async (page = 0, limit = 10, filters = {}) => {
//   try {
//     const skip = page * limit;
    
//     // Get total count for pagination
//     const totalCount = await Incident.countDocuments(filters);
    
//     // Determine sort direction - if date filter exists, sort ascending 
//     const sortDirection = filters.created_at ? 1 : -1;
    
//     // Get paginated data
//     const tickets = await Incident.find(filters)
//       .sort({ created_at: sortDirection })
//       .skip(skip)
//       .limit(limit)
//       .lean();
    
//     // Format data to match frontend expectations
//     const formattedTickets = tickets.map(ticket => ({
//       id: ticket._id,
//       subject: ticket.subject,
//       status: mapStatus(ticket.status), // Convert numeric status to string
//       priority: ticket.priority,
//       socAnalysis: ticket.soc_analysis,
//       socRecommendation: ticket.soc_recommendation,
//       sentinelIncidentNumber: ticket.sentinel_incident_number,
//       ttps: ticket.ttps,
//       description: ticket.description,
//       incidentType: ticket.incident_type,
//       incidentSubStatus: ticket.incident_sub_status,
//       createdDate: ticket.created_at,
//       updatedDate: ticket.updated_at,
//       agentName: ticket.agent_name,
//       customerName: ticket.customer_name
//     }));
    
//     return {
//       tickets: formattedTickets,
//       totalCount,
//       page,
//       limit
//     };
//   } catch (error) {
//     console.error('Error in getIncidentTickets:', error);
//     throw new Error('Error fetching incident tickets: ' + error.message);
//   }
// };

// // Helper function to map numeric status to string
// function mapStatus(statusCode) {
//   const statusMap = {
//     2: 'Open',
//     5: 'Closed',
//     3: 'Pending',
//     4: 'Resolved',
//     5: 'Closed'
//   };
//   return statusMap[statusCode] || 'Unknown';
// }








import Incident from '../models/incident.model.js';




export const getIncidentTickets = async (page = 0, limit = 10, filters = {}) => {
  try {
    const skip = page * limit;
    
    // Get total count for pagination
    const totalCount = await Incident.countDocuments(filters);
    
    // Determine sort direction - if date filter exists, sort ascending 
    const sortDirection = filters.created_at ? 1 : -1;
    
    // Get paginated data
    const tickets = await Incident.find(filters)
      .sort({ created_at: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Format data to match frontend expectations
    const formattedTickets = tickets.map(ticket => ({
      id: ticket._id,
      subject: ticket.subject,
      status: mapStatus(ticket.status), // Convert numeric status to string
      priority: ticket.priority,
      socAnalysis: ticket.soc_analysis,
      socRecommendation: ticket.soc_recommendation,
      sentinelIncidentNumber: ticket.sentinel_incident_number,
      ttps: ticket.ttps,
      description: ticket.description,
      incidentType: ticket.incident_type,
      incidentSubStatus: ticket.incident_sub_status,
      createdDate: ticket.created_at,
      updatedDate: ticket.updated_at,
      agentName: ticket.agent_name,
      customerName: ticket.customer_name
    }));
    
    return {
      tickets: formattedTickets,
      totalCount,
      page,
      limit
    };
  } catch (error) {
    console.error('Error in getIncidentTickets:', error);
    throw new Error('Error fetching incident tickets: ' + error.message);
  }
};

// Helper function to map numeric status to string
function mapStatus(statusCode) {
  const statusMap = {
    2: 'Open',
    3: 'Pending',
    4: 'Resolved',
    5: 'Closed',
    6: 'Escalated'
  };
  return statusMap[statusCode] || 'Unknown';
}