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
            "ajinomoto-thailand(ajt)": {
        displayName: "Ajinomoto Thailand",
        imageName: "customer_logo_5.webp"
      },
  

 "pt-tokairika-indonesia": {
    displayName: "PT Tokairika Indonesia",
    imageName: "customer_logo_6.webp"
  },
  "toyotaacseautocsengineeringcoltdsoc": {
    displayName: "Toyota ACSE Auto CS Engineering Co Ltd",
    imageName: "customer_logo_7.webp"
  },
  "pt-aisannasmocoindustri": {
    displayName: "PT Aisan Nasmoco Industri",
    imageName: "customer_logo_9.webp"
  },
  "aji-sentinel4apc-prod": {
    displayName: "Ajinomoto Philippines",
    imageName: "customer_logo_10.webp"
  },
  "toyotafmiautomtvcomponentspvtltdsoc": {
    displayName: "Toyota FMI Automotv Components Pvt Ltd",
    imageName: "customer_logo_11.webp"
  },
  "toyotaftsiptftsautomotiveindonesiasoc": {
    displayName: "Toyota FTSI PT FTS Automotive Indonesia",
    imageName: "customer_logo_12.webp"
  },
  "toyotaftsthftsautomotivethailandcoltd": {
    displayName: "Toyota FTSTH FTS Automotive Thailand Co Ltd",
    imageName: "customer_logo_13.webp"
  },
  "toyotahmmmyhinomotorsmalaysiasoc": {
    displayName: "Toyota HMMMY Hino Motors Malaysia",
    imageName: "customer_logo_14.webp"
  },
  "toyotahmmthinomotorsmnfcthailandltdsoc": {
    displayName: "Toyota HMMT Hino Motors Mnfc Thailand Ltd",
    imageName: "customer_logo_15.webp"
  },
  "toyotashirokiindonesiasoc": {
    displayName: "Toyota Shiroki Indonesia",
    imageName: "customer_logo_16.webp"
  },
  "toyotatgastoyodagoseiasiasoc": {
    displayName: "Toyota TGAS Toyoda Gosei Asia",
    imageName: "customer_logo_17.webp"
  },
  "toyotatgrttoyodagoseirubberthailandsoc": {
    displayName: "Toyota TGRT Toyoda Gosei Rubber Thailand",
    imageName: "customer_logo_18.webp"
  },
  "toyotatkttakebethailandcoltdsoc": {
    displayName: "Toyota TKT Takebe Thailand Co Ltd",
    imageName: "customer_logo_19.webp"
  },
  "toyotatrttokairikathailandcoltdsoc": {
    displayName: "Toyota TRT Tokairika Thailand Co Ltd",
    imageName: "customer_logo_20.webp"
  },
  "tts-asia-internal-soc-workspace-test": {
    displayName: "TTS Asia Internal",
    imageName: "customer_logo_21.webp"
  },
  "ajinomoto-cambodia-ajc": {
    displayName: "Ajinomoto Cambodia",
    imageName: "customer_logo_22.webp"
  },


  "toyotatsushoapacsoc": {
    displayName: "Toyota Tsusho Asia Pacific",
    imageName: "customer_logo_23.webp"
  },
  "toyotaadmptastradaihatsumotorsoc": {
    displayName: "Toyota ADM PT Astra Daihatsu Motor",
    imageName: "customer_logo_24.webp"
  },
  "toyotaafpaichiforgephilippinesincsoc": {
    displayName: "Toyota AFP Aichi Forge Philippines Inc",
    imageName: "customer_logo_25.webp"
  },
  "toyotaaftaichiforgethailandsoc": {
    displayName: "Toyota AFT Aichi Forge Thailand",
    imageName: "customer_logo_26.webp"
  },
  "toyotaakakawashimaindonesiasoc": {
    displayName: "Toyota AKA Kawashima Indonesia",
    imageName: "customer_logo_27.webp"
  },
  "toyotafigplfutabaindtrgujaratpvtltdsoc": {
    displayName: "Toyota FIGPL Futaba Indtr Gujarat Pvt Ltd",
    imageName: "customer_logo_28.webp"
  }
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


