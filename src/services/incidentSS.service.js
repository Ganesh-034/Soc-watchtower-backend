import Incident from '../models/incident.model.js';
 
export const getIncidentsSubStatus = async (userMonth) => {
  try {
    // Get the raw collection for more direct access
    const collection = Incident.collection;
   
    // Use aggregation to get counts by detection source
    const pipeline = [
      {
        $addFields: {
          month: {
            $dateToString: {
              format: "%Y-%m",
              date: { $toDate: "$created_at" }
            }
          }
        }
      },
      {
        $match: {
          month: userMonth
        }
      },
      {
        $group: {
          _id: "$incident_sub_status",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];
 
    const substatusCounts = await collection.aggregate(pipeline).toArray();
   
    // Clean up the status values
    const cleanedSubstatusCounts = substatusCounts.map(item => {
      if (!item._id) return item; // Handle null case
     
      let cleanedId = item._id;
     
      // Replace &nbsp; with spaces
      cleanedId = cleanedId.replace(/&nbsp;/g, ' ');
     
      // Extract the main status part without the parentheses
      if (cleanedId.includes('(')) {
        cleanedId = cleanedId.split('(')[0].trim();
      }
     
      return {
        _id: cleanedId,
        count: item.count
      };
    });
 
    return {
      substatus: cleanedSubstatusCounts
    };
  } catch (error) {
    console.error('Error in getTotalIncidents:', error);
    throw new Error('Error fetching incident counts: ' + error.message);
  }
};