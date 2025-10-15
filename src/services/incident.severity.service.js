// import Incident from '../models/incident.model.js';

// export const getIncidentSeverity = async () => {
//   try {
//     // Get the raw collection for more direct access
//     const collection = Incident.collection;
    
//     // Define customer name filter
//     const customerName = "tts-asia-internal-soc-workspace-test";
    
//     // Get current date information
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth(); // 0-indexed (0 = January)
    
//     // Calculate start dates for current month, previous month, and 2 months ago
//     const currentMonthStart = new Date(currentYear, currentMonth, 1);
//     const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
//     const twoMonthsAgoStart = new Date(currentYear, currentMonth - 2, 1);
//     const threeMonthsAgoStart = new Date(currentYear, currentMonth - 3, 1); 
    
//     // Create month identifiers with proper string interpolation
//     const currentMonthId = `${currentYear}- ${(currentMonth + 1).toString().padStart(2, '0')}`;
//     const previousMonthId = ` ${previousMonthStart.getFullYear()}- ${(previousMonthStart.getMonth() + 1).toString().padStart(2, '0')}`;
//     const twoMonthsAgoId = ` ${twoMonthsAgoStart.getFullYear()}- ${(twoMonthsAgoStart.getMonth() + 1).toString().padStart(2, '0')}`;
    
//     // Get month names
//     const currentMonthName = currentMonthStart.toLocaleString('default', { month: 'long' });
//     const previousMonthName = previousMonthStart.toLocaleString('default', { month: 'long' });
//     const twoMonthsAgoName = twoMonthsAgoStart.toLocaleString('default', { month: 'long' });
    
//     // Create a simpler pipeline that will work with string dates
//     const pipeline = [
//       {
//          $match: {
//           customer_name: customerName
//         }
//       },
//       {
//          $project: {
//           priority: 1,
//           created_at: 1
//         }
//       }
//     ];
    
//     const aggregationResults = await collection.aggregate(pipeline).toArray();
    
//     // Create the result object with month information
//     const result = {
//       customerName: customerName,
//       months: [
//         {
//           id: currentMonthId,
//           name: ` ${currentMonthName}  ${currentYear}`,
//           period: "Current Month",
//           priorities: { low: 0, medium: 0, high: 0 }
//         },
//         {
//           id: previousMonthId,
//           name: `${previousMonthName} ${previousMonthStart.getFullYear()}`,
//           period: "Previous Month",
//           priorities: { low: 0, medium: 0, high: 0 }
//         },
//         {
//           id: twoMonthsAgoId,
//           name: `${twoMonthsAgoName} ${twoMonthsAgoStart.getFullYear()}`,
//           period: "Two Months Ago",
//           priorities: { low: 0, medium: 0, high: 0 }
//         }
//       ],
//       total: { low: 0, medium: 0, high: 0 }
//     };
    
//     // Process results manually
//     aggregationResults.forEach(item => {
//       if (!item.created_at || !item.priority) return;
      
//       // Convert string date to Date object
//       let createdDate;
//       if (typeof item.created_at === 'string') {
//         createdDate = new Date(item.created_at);
//         if (isNaN(createdDate.getTime())) {
//           console.log(`Invalid date format for: ${item.created_at}`);
//           return;
//         }
//       } else if (item.created_at instanceof Date) {
//         createdDate = item.created_at;
//       } else {
//         console.log(`Unsupported date format: ${typeof item.created_at}`);
//         return;
//       }
      
//       // Map priority to low, medium, high (handling string values)
//       let priorityKey;
//       if (typeof item.priority === 'string') {
//         // Handle string priority
//         const priorityLower = item.priority.toLowerCase();
//         if (priorityLower.includes('low')) priorityKey = "low";
//         else if (priorityLower.includes('medium') || priorityLower.includes('med')) priorityKey = "medium";
//         else if (priorityLower.includes('high')) priorityKey = "high";
//         else return; // Skip if not a recognized priority
//       } else if (typeof item.priority === 'number') {
//         // Handle numeric priority
//         if (item.priority === 1) priorityKey = "low";
//         else if (item.priority === 2) priorityKey = "medium";
//         else if (item.priority === 3) priorityKey = "high";
//         else return; // Skip if not a recognized priority
//       } else {
//         console.log(`Unsupported priority format: ${typeof item.priority}`);
//         return;
//       }
      
//       // Check which month this date falls into
//       if (createdDate >= currentMonthStart && createdDate <= now) {
//         result.months[0].priorities[priorityKey]++;
//         result.total[priorityKey]++;
//       } 
//       else if (createdDate >= previousMonthStart && createdDate < currentMonthStart) {
//         result.months[1].priorities[priorityKey]++;
//         result.total[priorityKey]++;
//       }
//       else if (createdDate >= twoMonthsAgoStart && createdDate < previousMonthStart) {
//         result.months[2].priorities[priorityKey]++;
//         result.total[priorityKey]++;
//       }
//     });
    
//     return result;
    
//   } catch (error) {
//     console.error('Error in getIncidentSeverity:', error);
//     throw new Error('Error fetching incident priorities: ' + error.message);
//   }
// };




import Incident from '../models/incident.model.js';

export const getIncidentSeverity = async () => {
  try {
    // Get the raw collection for more direct access
    const collection = Incident.collection;
    
    // Define customer name filter
    const customerName = "tts-asia-internal-soc-workspace-test";
    
    // Get current date information
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = January)
    
    // Calculate start dates for current month, previous month, and 2 months ago
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const twoMonthsAgoStart = new Date(currentYear, currentMonth - 2, 1);
    const threeMonthsAgoStart = new Date(currentYear, currentMonth - 3, 1); 
    
    // Create month identifiers with proper string interpolation (removing extra spaces)
    const currentMonthId = `${currentYear}- ${(currentMonth + 1).toString().padStart(2, '0')}`;
    const previousMonthId = `${previousMonthStart.getFullYear()}- ${(previousMonthStart.getMonth() + 1).toString().padStart(2, '0')}`;
    const twoMonthsAgoId = `${twoMonthsAgoStart.getFullYear()}- ${(twoMonthsAgoStart.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Get abbreviated month names (like "Oct" instead of "October")
    const currentMonthName = currentMonthStart.toLocaleString('default', { month: 'short' });
    const previousMonthName = previousMonthStart.toLocaleString('default', { month: 'short' });
    const twoMonthsAgoName = twoMonthsAgoStart.toLocaleString('default', { month: 'short' });
    
    // Create a simpler pipeline that will work with string dates
    const pipeline = [
      {
          $match: {
          customer_name: customerName
        }
      },
      {
          $project: {
          priority: 1,
          created_at: 1
        }
      }
    ];
    
    const aggregationResults = await collection.aggregate(pipeline).toArray();
    
    // Create the result object with month information
    const result = {
      customerName: customerName,
      months: [
        {
          id: currentMonthId,
          name: currentMonthName,  // Only the month abbreviation without year
          period: "Current Month",
          priorities: { low: 0, medium: 0, high: 0 }
        },
        {
          id: previousMonthId,
          name: previousMonthName,  // Only the month abbreviation without year
          period: "Previous Month",
          priorities: { low: 0, medium: 0, high: 0 }
        },
        {
          id: twoMonthsAgoId,
          name: twoMonthsAgoName,  // Only the month abbreviation without year
          period: "Two Months Ago",
          priorities: { low: 0, medium: 0, high: 0 }
        }
      ],
      total: { low: 0, medium: 0, high: 0 }
    };
    
    // Process results manually
    aggregationResults.forEach(item => {
      if (!item.created_at || !item.priority) return;
      
      // Convert string date to Date object
      let createdDate;
      if (typeof item.created_at === 'string') {
        createdDate = new Date(item.created_at);
        if (isNaN(createdDate.getTime())) {
          console.log(`Invalid date format for:  ${item.created_at}`);
          return;
        }
      } else if (item.created_at instanceof Date) {
        createdDate = item.created_at;
      } else {
        console.log(`Unsupported date format:  ${typeof item.created_at}`);
        return;
      }
      
      // Map priority to low, medium, high (handling string values)
      let priorityKey;
      if (typeof item.priority === 'string') {
        // Handle string priority
        const priorityLower = item.priority.toLowerCase();
        if (priorityLower.includes('low')) priorityKey = "low";
        else if (priorityLower.includes('medium') || priorityLower.includes('med')) priorityKey = "medium";
        else if (priorityLower.includes('high')) priorityKey = "high";
        else return; // Skip if not a recognized priority
      } else if (typeof item.priority === 'number') {
        // Handle numeric priority
        if (item.priority === 1) priorityKey = "low";
        else if (item.priority === 2) priorityKey = "medium";
        else if (item.priority === 3) priorityKey = "high";
        else return; // Skip if not a recognized priority
      } else {
        console.log(`Unsupported priority format:  ${typeof item.priority}`);
        return;
      }
      
      // Check which month this date falls into
      if (createdDate >= currentMonthStart && createdDate <= now) {
        result.months[0].priorities[priorityKey]++;
        result.total[priorityKey]++;
      } 
      else if (createdDate >= previousMonthStart && createdDate < currentMonthStart) {
        result.months[1].priorities[priorityKey]++;
        result.total[priorityKey]++;
      }
      else if (createdDate >= twoMonthsAgoStart && createdDate < previousMonthStart) {
        result.months[2].priorities[priorityKey]++;
        result.total[priorityKey]++;
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('Error in getIncidentSeverity:', error);
    throw new Error('Error fetching incident priorities: ' + error.message);
  }
};