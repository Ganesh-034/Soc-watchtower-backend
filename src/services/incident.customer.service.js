import { ApiError } from "../utils/ApiError.js";
/**
 * Service: getCustomer
 *
 * Fetch customer details by name.
 *
 * Validates the input, checks if the customer exists in the mapping,
 * and returns display name and image information.
 *
 * @param {string} customerName - Name of the customer to fetch details for (required)
 *
 * @returns {Object} - Customer details { customerName, displayName, imageName }
 * @throws {ApiError} 400 - Invalid or missing customerName
 * @throws {ApiError} 404 - Customer not found
 * @throws {ApiError} 500 - Error fetching customer information
 */
export const getCustomer = async (customerName) => {
  try {
    // 400 Bad Request for invalid/missing input
    if (typeof customerName !== "string" || !customerName.trim()) {
      throw new ApiError(400, "customerName is required");
    }

    const name = customerName.trim();
  
    // Mapping of customer names and image names.
    const customerMapping = {
      "Hino Motor- HMST": {
        displayName: "Hino Motor Sales Thailand HMST",
        imageName: "customer_logo_1.webp"
      },
      "centralmotorwheel-thailand": {
        displayName: "Centralmotorwheel Thailand",
        imageName: "customer_logo_2.webp"
      },
      "PT.RKNForge": {
        displayName: "PT RKN Forge Indonesia",
        imageName: "customer_logo_3.webp"
      },
      "taiho-thailand": {
        displayName: "Taiho Thailand",
        imageName: "customer_logo_4.webp"
      },
    };
    
    // Check if customer exists in our mapping
    if (!customerMapping.hasOwnProperty(name)) {
      throw new ApiError(404, `Customer "${name}" not found`);
    }

    // Return all details
    return {
      customerName: name,
      displayName: customerMapping[name].displayName,
      imageName: customerMapping[name].imageName
    };
    
  } catch (error) {
    console.error("Error in getCustomerInfo:", error);

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Error fetching customer information: " + error.message);
  }
};


