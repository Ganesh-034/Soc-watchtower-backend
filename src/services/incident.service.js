// // incident.service.js
// import Incident from '../models/incident.model.js';

// /**
//  * Get total count of incidents
//  * @returns {Promise<number>}
//  */
// export const getTotalIncidents = async () => {
//   try {
//     // This will now actually query the MongoDB database
//     const count = await Incident.countDocuments();
//     return count;
//   } catch (error) {
//     throw new Error('Error fetching total incidents: ' + error.message);
//   }
// };





import Incident from '../models/incident.model.js';

export const getTotalIncidents = async () => {
  try {
    // Get the raw collection for more direct access
    const collection = Incident.collection;
    
    // Get total count
    const totalCount = await collection.countDocuments({});
    
    // Use aggregation to get counts by status
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ];
    
    const statusCounts = await collection.aggregate(pipeline).toArray();
    
    // Initialize counts
    let openCount = 0;
    let closedCount = 0;
    
    // Find the counts for status 2 (open) and status 5 (closed)
    statusCounts.forEach(item => {
      if (item._id === 2) openCount = item.count;
      if (item._id === 5) closedCount = item.count;
    });
    
    return {
      total: totalCount,
      open: openCount,
      closed: closedCount
    };
  } catch (error) {
    console.error('Error in getTotalIncidents:', error);
    throw new Error('Error fetching incident counts: ' + error.message);
  }
};