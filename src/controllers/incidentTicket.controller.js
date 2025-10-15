// import { ApiResponse } from '../utils/ApiResponse.js';
// import { ApiError } from '../utils/ApiError.js';
// import catchAsync from '../utils/catchAsync.js';
// import * as incidentTicketService from '../services/incidentTicket.service.js';

// export const getIncidentTickets = catchAsync(async (req, res) => {
//   // Get query parameters for filtering, pagination, etc.
//   const { page = 0, limit = 10, search, startDate, endDate } = req.query;
  
//   const filters = {};
//   if (search) {
//     // Add text search capability
//     filters.$or = [
//       { subject: { $regex: search, $options: 'i' } },
//       { description: { $regex: search, $options: 'i' } }
//     ];
//   }
  
//   // Add date range filter if provided
//   if (startDate || endDate) {
//     filters.created_at = {};
//     if (startDate) filters.created_at.$gte = new Date(startDate);
//     if (endDate) filters.created_at.$lte = new Date(endDate);
//   }
  
//   const tickets = await incidentTicketService.getIncidentTickets(
//     parseInt(page), 
//     parseInt(limit), 
//     filters
//   );
  
//   res.json(new ApiResponse(200, tickets, "Incident tickets fetched successfully"));
// });







// import { ApiResponse } from '../utils/ApiResponse.js';
// import { ApiError } from '../utils/ApiError.js';
// import catchAsync from '../utils/catchAsync.js';
// import * as incidentTicketService from '../services/incidentTicket.service.js';

// export const getIncidentTickets = catchAsync(async (req, res) => {
//   // Get query parameters for filtering, pagination, etc.
//   const { page = 0, limit = 10, search, startDate, endDate } = req.query;
  
//   console.log("Processing request with:", { 
//     page: parseInt(page), 
//     limit: parseInt(limit), 
//     search, 
//     startDate, 
//     endDate 
//   });
  
//   const filters = {};
  
//   if (search) {
//     // Add text search capability
//     filters.$or = [
//       { subject: { $regex: search, $options: 'i' } },
//       { description: { $regex: search, $options: 'i' } }
//     ];
//   }
  
//   // Add date range filter if provided
//   if (startDate || endDate) {
//     console.log("Adding date range filter:", { startDate, endDate });
//     filters.created_at = {};
//     if (startDate) {
//       // Use the date string directly since dates are stored as strings in the DB
//       filters.created_at.$gte = startDate;
//       console.log("Start date filter:", startDate);
//     }
//     if (endDate) {
//       // Use the date string directly since dates are stored as strings in the DB
//       filters.created_at.$lte = endDate;
//       console.log("End date filter:", endDate);
//     }
//   }
  
//   console.log("Final MongoDB filters:", JSON.stringify(filters));
  
//   const tickets = await incidentTicketService.getIncidentTickets(
//     parseInt(page), 
//     parseInt(limit), 
//     filters
//   );
  
//   console.log(`Found ${tickets.tickets?.length} tickets out of ${tickets.totalCount} total`);
  
//   res.json(new ApiResponse(200, tickets, "Incident tickets fetched successfully"));
// });









// import { ApiResponse } from '../utils/ApiResponse.js';
// import catchAsync from '../utils/catchAsync.js';
// import * as incidentTicketService from '../services/incidentTicket.service.js';

// export const getIncidentTickets = catchAsync(async (req, res) => {
//   // Get query parameters for filtering, pagination, etc.
//   const { page = 0, limit = 10, filters, startDate, endDate } = req.query;
  
//   console.log("Processing request with:", { 
//     page: parseInt(page), 
//     limit: parseInt(limit), 
//     filters,
//     startDate, 
//     endDate 
//   });
  
//   const mongoFilters = {};
  
//   // Process column-specific filters
//   if (filters) {
//     try {
//       const parsedFilters = JSON.parse(filters);
      
//       // Build MongoDB query based on filter types
//       parsedFilters.forEach(filter => {
//         const { column, value } = filter;
        
//         // Map frontend column names to database field names
//         const fieldMap = {
//           subject: 'subject',
//           description: 'description',
//           status: 'status',  
//           priority: 'priority',
//           incidentType: 'incident_type',
//           incidentSubStatus: 'incident_sub_status',
//           socAnalysis: 'soc_analysis',
//           sentinelIncidentNumber: 'sentinel_incident_number',
//           ttps: 'ttps'
//         };
        
//         const dbField = fieldMap[column];
        
//         if (dbField) {
//           // Special handling for status which uses numeric codes
//           if (column === 'status') {
//             // Get status code from status name
//             const statusMap = {
//               'Open': 2,
//               'Pending': 3,
//               'Resolved': 4,
//               'Closed': 5
//             };
            
//             // If the value is an exact match for a status name, use the numeric code
//             if (statusMap[value] !== undefined) {
//               mongoFilters[dbField] = statusMap[value];
//             } else {
//               // Otherwise, treat it as a text search on the status string
//               mongoFilters[dbField] = { $regex: value, $options: 'i' };
//             }
//           } 
//           // For other string fields, use case-insensitive regex
//           else {
//             mongoFilters[dbField] = { $regex: value, $options: 'i' };
//           }
//         }
//       });
      
//       console.log("Processed filters:", mongoFilters);
//     } catch (error) {
//       console.error("Error parsing filters:", error);
//     }
//   }
  
//   // Add date range filter if provided
//   if (startDate || endDate) {
//     mongoFilters.created_at = mongoFilters.created_at || {};
//     if (startDate) {
//       mongoFilters.created_at.$gte = startDate;
//     }
//     if (endDate) {
//       mongoFilters.created_at.$lte = endDate;
//     }
//   }
  
//   console.log("Final MongoDB filters:", JSON.stringify(mongoFilters));
  
//   const tickets = await incidentTicketService.getIncidentTickets(
//     parseInt(page), 
//     parseInt(limit), 
//     mongoFilters
//   );
  
//   console.log(`Found ${tickets.tickets?.length} tickets out of ${tickets.totalCount} total`);
  
//   res.json(new ApiResponse(200, tickets, "Incident tickets fetched successfully"));
// });








import { ApiResponse } from '../utils/ApiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as incidentTicketService from '../services/incidentTicket.service.js';

// In your controller

// Update the status map to handle case-insensitive status names
const statusMap = {
  'open': 2,
  'pending': 3,
  'resolved': 4,
  'closed': 5,
  'escalated': 6
};

export const getIncidentTickets = catchAsync(async (req, res) => {
  // Get query parameters for filtering, pagination, etc.
  const { page = 0, limit = 10, filters, startDate, endDate } = req.query;
  
  console.log("Processing request with:", { 
    page: parseInt(page), 
    limit: parseInt(limit), 
    filters,
    startDate, 
    endDate 
  });
  
  const mongoFilters = {};
  
  // Process column-specific filters
  if (filters) {
    try {
      const parsedFilters = JSON.parse(filters);
      
      // Build MongoDB query based on filter types
      parsedFilters.forEach(filter => {
        const { column, value } = filter;
        
        // Map frontend column names to database field names
        const fieldMap = {
            id:'_id',
          subject: 'subject',
          description: 'description',
          status: 'status',  
          priority: 'priority',
          incidentType: 'incident_type',
          incidentSubStatus: 'incident_sub_status',
          socAnalysis: 'soc_analysis',
          socRecommendation: 'soc_recommendation',
          sentinelIncidentNumber: 'sentinel_incident_number',
          ttps: 'ttps',
            agentName: 'agent_name',     // Add this line
    customerName: 'customer_name' // Add this line
        };
        
        const dbField = fieldMap[column];
        
        if (dbField) {
          // Special handling for status which uses numeric codes
          if (column === 'status') {
            // Convert to lowercase to handle case-insensitive matching
            const normalizedValue = value.trim().toLowerCase();
            const statusCode = statusMap[normalizedValue];
            
            if (statusCode !== undefined) {
              // If there's an exact match in the status map, use the numeric code
              mongoFilters[dbField] = statusCode;
              console.log(`Mapping status "${value}" to code ${statusCode}`);
            } else {
              // No exact match found, check if it might be a partial match
              const possibleMatches = Object.keys(statusMap).filter(
                status => status.toLowerCase().includes(normalizedValue)
              );
              
              if (possibleMatches.length > 0) {
                // Create an $in query with all matching status codes
                mongoFilters[dbField] = { 
                  $in: possibleMatches.map(match => statusMap[match]) 
                };
                console.log(`Mapping status "${value}" to codes: ${JSON.stringify(mongoFilters[dbField])}`);
              } else {
                // No match found at all, log this but don't apply a filter that would return nothing
                console.log(`No status match found for "${value}"`);
                // Could either skip this filter or use something that will match nothing
                mongoFilters[dbField] = -1; // This will match no records if no status match found
              }
            }
          } 
          // For other string fields, use case-insensitive regex
          else {
            mongoFilters[dbField] = { $regex: value, $options: 'i' };
          }
        }
      });
      
      console.log("Processed filters:", mongoFilters);
    } catch (error) {
      console.error("Error parsing filters:", error);
    }
  }
  
  // Add date range filter if provided - KEEPING ORIGINAL IMPLEMENTATION
  if (startDate || endDate) {
    mongoFilters.created_at = mongoFilters.created_at || {};
    if (startDate) {
      mongoFilters.created_at.$gte = startDate;
    }
    if (endDate) {
      mongoFilters.created_at.$lte = endDate;
    }
  }
  
  console.log("Final MongoDB filters:", JSON.stringify(mongoFilters));
  
  const tickets = await incidentTicketService.getIncidentTickets(
    parseInt(page), 
    parseInt(limit), 
    mongoFilters
  );
  
  console.log(`Found ${tickets.tickets?.length} tickets out of ${tickets.totalCount} total`);
  
  res.json(new ApiResponse(200, tickets, "Incident tickets fetched successfully"));
});