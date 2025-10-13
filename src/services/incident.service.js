// import Incident from '../models/incident.model.js';

// /**
//  * Get total count of incidents
//  * @returns {Promise<number>}
//  */
// export const getTotalIncidents = async () => {
//   try {
//     // Since MongoDB is not up, we'll mock the data
//     // In a real scenario, this would be: return await Incident.countDocuments();
//     return 459; // Mock data as per your frontend example
//   } catch (error) {
//     throw new Error('Error fetching total incidents: ' + error.message);
//   }
// };






// incident.service.js
import Incident from '../models/incident.model.js';

/**
 * Get total count of incidents
 * @returns {Promise<number>}
 */
export const getTotalIncidents = async () => {
  try {
    // This will now actually query the MongoDB database
    const count = await Incident.countDocuments();
    return count;
  } catch (error) {
    throw new Error('Error fetching total incidents: ' + error.message);
  }
};