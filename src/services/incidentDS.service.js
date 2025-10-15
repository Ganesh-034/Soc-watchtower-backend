import Incident from '../models/incident.model.js';

export const getIncidentsDetectionSource = async (userMonth) => {
  try {
    // Get the raw collection for more direct access
    const collection = Incident.collection;
    // const userMonth = "2025-10";
    // Get total count
    // const totalCount = await collection.countDocuments({});

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
          _id: "$incident_type",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }

    ];

    const detectionsourceCounts = await collection.aggregate(pipeline).toArray();

    // // Initialize counts
    // let openCount = 0;
    // let closedCount = 0;

    // // Find the counts for status 2 (open) and status 5 (closed)
    // detectionsourceCounts.forEach(item => {
    //   if (item._id === 2) openCount = item.count;
    //   if (item._id === 5) closedCount = item.count;
    // });

    return {
      detectionsource: detectionsourceCounts
      //   total: totalCount,
      //   open: openCount,
      //   closed: closedCount
    };
  } catch (error) {
    console.error('Error in getTotalIncidents:', error);
    throw new Error('Error fetching incident counts: ' + error.message);
  }
};