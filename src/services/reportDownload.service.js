import {
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { BlobServiceClient } from "@azure/storage-blob";
import mongoose from "mongoose";
import logger from "../config/logger.js";

// Default connection (for other operations)
// This is your existing connection
const defaultConnection = mongoose.connection;

// New dedicated connection for reports
let reportsDBConnection;

// Function to initialize the reports database connection
async function initializeReportsDBConnection() {
  try {
    if (!reportsDBConnection) {
      logger.info("🔗 Initializing reports database connection...");
      reportsDBConnection = await mongoose.createConnection(
        process.env.MONGODB_URI,
        {
          dbName: "reports_db", // Explicitly set database name
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        }
      );
      
      reportsDBConnection.on('connected', () => {
        logger.info("✅ Reports database connected successfully");
      });
      
      reportsDBConnection.on('error', (err) => {
        logger.error("❌ Reports database connection error:", err);
      });
      
      reportsDBConnection.on('disconnected', () => {
        logger.warn("⚠️ Reports database disconnected");
      });
    }
    return reportsDBConnection;
  } catch (error) {
    logger.error("❌ Failed to initialize reports database connection:", error);
    throw error;
  }
}

// Azure Blob Storage configuration
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME
);

// Customer configuration - bidirectional mapping
const customers = {
  //   toyotatsushoapacsoc: "Toyota Tsusho Asia Pacific",
  // "ajinomoto-thailand(ajt)": "Ajinomoto Thailand",
  // "hino motor- hmst": "Hino Motor Sales Thailand HMST", // can remove this
  // "pt.rknforge": "PT RKN Forge Indonesia",
  // "aji-sentinel4apc-prod": "Ajinomoto Philippines",
  // "centralmotorwheel-thailand": "Centralmotorwheel Thailand",
  // // "log-scg-logistics-sentinel-hub": "SCG Logistics Sentinel Hub",
  // "pt-aisannasmocoindustri": "PT Aisan Nasmoco Industri",
  "pt-tokairika-indonesia": "PT Tokairika Indonesia",
  // "taiho-thailand": "Taiho Thailand",
  // toyotaacseautocsengineeringcoltdsoc: "Toyota ACSE Auto CS Engineering Co Ltd",
  // toyotaadmptastradaihatsumotorsoc: "Toyota ADM PT Astra Daihatsu Motor",
  // toyotaafpaichiforgephilippinesincsoc:
  //   "Toyota AFP Aichi Forge Philippines Inc",
  // toyotaaftaichiforgethailandsoc: "Toyota AFT Aichi Forge Thailand",
  // toyotaakakawashimaindonesiasoc: "Toyota AKA Kawashima Indonesia",
  // toyotafigplfutabaindtrgujaratpvtltdsoc:
  //   "Toyota FIGPL Futaba Indtr Gujarat Pvt Ltd",
  // toyotafmiautomtvcomponentspvtltdsoc: "Toyota FMI Automotv Components Pvt Ltd",
  // toyotaftsiptftsautomotiveindonesiasoc:
  //   "Toyota FTSI PT FTS Automotive Indonesia",
  // toyotaftsthftsautomotivethailandcoltd:
  //   "Toyota FTSTH FTS Automotive Thailand Co Ltd",
  // toyotahmmmyhinomotorsmalaysiasoc: "Toyota HMMMY Hino Motors Malaysia",
  // toyotahmmthinomotorsmnfcthailandltdsoc:
  //   "Toyota HMMT Hino Motors Mnfc Thailand Ltd",
  // toyotashirokiindonesiasoc: "Toyota Shiroki Indonesia",
  // toyotatgastoyodagoseiasiasoc: "Toyota TGAS Toyoda Gosei Asia",
  // toyotatgrttoyodagoseirubberthailandsoc:
  //   "Toyota TGRT Toyoda Gosei Rubber Thailand",
  // toyotatkttakebethailandcoltdsoc: "Toyota TKT Takebe Thailand Co Ltd",
  // toyotatrttokairikathailandcoltdsoc: "Toyota TRT Tokairika Thailand Co Ltd",
  // "tts-asia-internal-soc-workspace-test": "TTS Asia Internal",
  // "ajinomoto-cambodia-ajc": "Ajinomoto Cambodia",
};

// Helper function to get customer key from either key or display name
function getCustomerKey(customerIdentifier) {
  logger.info(`🔍 Looking up customer key for identifier: "${customerIdentifier}"`);
  
  // If it's already a key (from token), return it
  if (
    customers[customerIdentifier] &&
    typeof customers[customerIdentifier] === "string"
  ) {
    logger.info(`✅ Found direct match: "${customerIdentifier}"`);
    return customerIdentifier;
  }

  // If it's a display name, return the corresponding key
  for (const [key, value] of Object.entries(customers)) {
    if (value === customerIdentifier) {
      logger.info(`✅ Found reverse match: "${customerIdentifier}" -> "${key}"`);
      return key;
    }
  }

  logger.warn(`❌ No match found for customer identifier: "${customerIdentifier}"`);
  return null;
}

// Helper function to get customer display name from key
function getCustomerDisplayName(customerKey) {
  const displayName = customers[customerKey] || "Unknown Customer";
  logger.info(`🏷️ Display name for "${customerKey}": "${displayName}"`);
  return displayName;
}

// Define ReportStatus schema
const ReportStatusSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true },
  customerKey: { type: String, required: true },
  customerDisplayName: { type: String, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      "queued",
      "generating",
      "generated",
      "uploading",
      "uploaded",
      "verified",
      "failed",
      "retrying",
    ],
    default: "queued",
  },
  blobUrl: { type: String },
  blobPath: { type: String },
  checksum: { type: String },
  error: { type: String },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  fileSize: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date },
});

// Helper function to get ReportStatus model from the reports database
function getReportsStatusModel() {
  // Ensure the reports DB connection is initialized
  if (!reportsDBConnection) {
    throw new Error("Reports database connection not initialized. Call initializeReportsDBConnection() first.");
  }
  
  // Check if model is already registered with this connection
  if (reportsDBConnection.models.ReportStatus) {
    logger.info(`📋 Using existing ReportStatus model from reports DB`);
    return reportsDBConnection.models.ReportStatus;
  }

  logger.info(`📋 Creating new ReportStatus model for reports DB`);
  return reportsDBConnection.model("ReportStatus", ReportStatusSchema);
}

// Function to check if a blob exists in Azure Storage
async function checkBlobExists(blobPath) {
  try {
    logger.info(`🔍 Checking blob existence: "${blobPath}"`);

    // Normalize path (remove duplicate slashes, trim)
    const normalized = blobPath.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");

    const encodedBlobPath = normalized
      .split("/")
      .map((segment) => {
        if (!segment) return segment;

        // If it looks already percent-encoded, don’t re-encode
        const looksEncoded =
          /%[0-9A-Fa-f]{2}/.test(segment) &&
          decodeURIComponent(segment) !== segment;

        return looksEncoded ? segment : encodeURIComponent(segment);
      })
      .join("/");

    logger.info(`🔐 Encoded blob path: "${encodedBlobPath}"`);

    const blobClient = containerClient.getBlobClient(encodedBlobPath);
    const exists = await blobClient.exists();

    logger.info(`📦 Blob exists result: ${exists}`);
    return exists;
  } catch (error) {
    logger.error(`❌ Error checking if blob exists: ${blobPath}`, error);
    return false;
  }
}

// Function to generate SAS URL for a specific report
async function getReportSasUrl(req, res) {
  try {
    logger.info(`🚀 getReportSasUrl called`);
    logger.info(`📥 Request params: ${JSON.stringify(req.params)}`);
    logger.info(`👤 Request customer: ${JSON.stringify(req.customerName)}`);
    
    const { month, year } = req.params;

    // Get customer identifier from the authenticated request
    const customerIdentifier = req.customerName;
    logger.info(`🔑 Customer identifier from request: "${customerIdentifier}"`);

    if (!customerIdentifier) {
      logger.error(`❌ Customer information not available`);
      return res
        .status(403)
        .json({ error: "Customer information not available" });
    }

    // Get customer key from identifier
    const customerKey = getCustomerKey(customerIdentifier);

    if (!customerKey) {
      logger.error(`❌ Customer not recognized: "${customerIdentifier}"`);
      return res.status(403).json({ error: "Customer not recognized" });
    }

    // Get display name
    const customerDisplayName = getCustomerDisplayName(customerKey);

    // Validate parameters
    if (!month || !year) {
      logger.error(`❌ Missing required parameters: month=${month}, year=${year}`);
      return res
        .status(400)
        .json({ error: "Missing required parameters: month, year" });
    }

    const reportId = `${customerKey}_${month}_${year}`;
    logger.info(`📄 Report ID: "${reportId}"`);

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    // Find the report in the database
    logger.info(`🔍 Searching for report with ID: "${reportId}"`);
    const report = await ReportStatus.findOne({ reportId });

    if (!report) {
      logger.error(`❌ Report not found: "${reportId}"`);
      return res.status(404).json({ error: "Report not found" });
    }

    logger.info(`✅ Found report: ${JSON.stringify(report.toObject())}`);

    if (report.status !== "verified") {
      logger.error(`❌ Report not ready for download. Status: "${report.status}"`);
      return res.status(400).json({
        error: "Report is not ready for download",
        status: report.status,
      });
    }

    // Check if the blob actually exists in Azure Storage
    if (!report.blobPath) {
      logger.error(`❌ Report file path not available`);
      return res.status(404).json({ error: "Report file path not available" });
    }

    logger.info(`📂 Blob path: "${report.blobPath}"`);
    const blobExists = await checkBlobExists(report.blobPath);

    if (!blobExists) {
      logger.warn(
        `⚠️ Blob not found for report ${reportId}: ${report.blobPath}`
      );
      return res.status(404).json({ error: "Report file not found" });
    }

    // Create SAS token that's valid for 1 hour
    const sasExpiresOn = new Date();
    sasExpiresOn.setMinutes(sasExpiresOn.getMinutes() + 60);

    // THE CRITICAL FIX:
    // Parse the blob URL to extract the correct container and blob name
    const blobUrl = new URL(report.blobUrl);
    const pathParts = blobUrl.pathname.split('/');
    
    // The first part after the hostname is the container name
    const containerName = pathParts[1];
    
    // The rest is the blob path (including folders)
    const blobName = pathParts.slice(2).join('/');
    
    logger.info(`🔐 Container: "${containerName}", Blob: "${blobName}"`);
    
    // Generate SAS token with the correct container and blob name
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: containerName, // Use the extracted container name
        blobName: blobName, // Use the extracted blob name (not encoded)
        permissions: BlobSASPermissions.parse("r"), // Read permission
        expiresOn: sasExpiresOn,
      },
      new StorageSharedKeyCredential(
        process.env.AZURE_STORAGE_ACCOUNT_NAME,
        process.env.AZURE_STORAGE_ACCOUNT_KEY
      )
    );

    // Construct SAS URL with the original blob URL
    const sasUrl = `${report.blobUrl}?${sasToken}`;
    logger.info(`🔗 Generated SAS URL: ${sasUrl}`);

    // Log the download request for audit purposes
    logger.info(
      `🔑 Generated SAS URL for report ${reportId} for customer ${customerDisplayName}`
    );

    res.json({
      downloadUrl: sasUrl,
      fileName: `${customerKey}_Monthly_Report_${month}_${year}.pdf`,
      expiresOn: sasExpiresOn,
      customerKey, // Return for frontend display
      customerDisplayName,
    });
  } catch (error) {
    logger.error("❌ Error generating SAS URL:", error);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
}
// Function to get all available reports for the authenticated user's customer
async function getAvailableReportsForCustomer(req, res) {
  try {
    logger.info(`🚀 getAvailableReportsForCustomer called`);
    
    // Get customer identifier from the authenticated request
    const customerIdentifier = req.customerName;
    logger.info(`🔑 Customer identifier from request: "${customerIdentifier}"`);

    if (!customerIdentifier) {
      logger.error(`❌ Customer information not available`);
      return res
        .status(400)
        .json({ error: "Customer information not available" });
    }

    // Get customer key from identifier
    const customerKey = getCustomerKey(customerIdentifier);

    if (!customerKey) {
      logger.error(`❌ Customer not recognized: "${customerIdentifier}"`);
      return res.status(400).json({ error: "Customer not recognized" });
    }

    // Get display name
    const customerDisplayName = getCustomerDisplayName(customerKey);

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    // Find all verified reports for this customer
    logger.info(`🔍 Searching for verified reports for customer: "${customerKey}"`);
    const reports = await ReportStatus.find({
      customerKey,
      status: "verified",
    }).sort({ year: -1, month: -1 });

    logger.info(`📊 Found ${reports.length} verified reports in database`);

    if (reports.length === 0) {
      logger.info(`📊 No reports found for customer: "${customerKey}"`);
      return res.status(204).end();
    }

    // Check which blobs actually exist
    logger.info(`🔍 Checking blob existence for ${reports.length} reports`);
    const reportsWithBlobStatus = await Promise.all(
      reports.map(async (report) => {
        logger.info(`🔍 Processing report: ${report.reportId}`);
        const blobExists = report.blobPath
          ? await checkBlobExists(report.blobPath)
          : false;

        logger.info(`📦 Report ${report.reportId} blob exists: ${blobExists}`);

        return {
          reportId: report.reportId,
          customerKey: report.customerKey,
          customerDisplayName: report.customerDisplayName,
          month: report.month,
          year: report.year,
          blobUrl: report.blobUrl,
          blobPath: report.blobPath,
          fileSize: report.fileSize,
          createdAt: report.createdAt,
          verifiedAt: report.verifiedAt,
          blobExists: blobExists, // Include blob existence status
        };
      })
    );

    const response = {
      customerKey,
      customerDisplayName,
      reports: reportsWithBlobStatus,
    };

    logger.info(`📤 Sending response with ${response.reports.length} reports`);
    res.json(response);
  } catch (error) {
    logger.error("❌ Error fetching available reports:", error);
    res.status(500).json({ error: "Failed to fetch available reports" });
  }
}

// Debug function to check customer mapping and reports
async function debugReports(req, res) {
  try {
    const customerIdentifier = req.customerName;
    const customerKey = getCustomerKey(customerIdentifier);
    const customerDisplayName = getCustomerDisplayName(customerKey);

    console.log("=== DEBUG INFO ===");
    console.log("Customer Identifier from token:", customerIdentifier);
    console.log("Customer Key from mapping:", customerKey);
    console.log("Customer Display Name:", customerDisplayName);
    console.log("Available customers:", Object.keys(customers));

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    // Find ALL reports for this customer (not just verified)
    const allReports = await ReportStatus.find({
      customerKey: customerKey || "unknown",
    });

    console.log("All reports for customer:", allReports.length);

    // Check blob existence for each report
    const reportsWithBlobStatus = await Promise.all(
      allReports.map(async (report) => {
        const blobExists = report.blobPath
          ? await checkBlobExists(report.blobPath)
          : false;

        console.log(
          `- ${report.reportId}: ${report.status} (${report.month}/${report.year})`
        );
        console.log(`  Blob URL: ${report.blobUrl}`);
        console.log(`  Blob Path: ${report.blobPath}`);
        console.log(`  Blob Exists: ${blobExists}`);

        return {
          ...report.toObject(),
          blobExists,
        };
      })
    );

    // Find only verified reports
    const verifiedReports = reportsWithBlobStatus.filter(
      (report) => report.status === "verified"
    );
    const verifiedReportsWithBlob = verifiedReports.filter(
      (report) => report.blobExists
    );

    console.log("Verified reports for customer:", verifiedReports.length);
    console.log(
      "Verified reports with existing blob:",
      verifiedReportsWithBlob.length
    );

    res.json({
      customerIdentifier,
      customerKey,
      customerDisplayName,
      totalReports: allReports.length,
      verifiedReports: verifiedReports.length,
      verifiedReportsWithBlob: verifiedReportsWithBlob.length,
      allReports: reportsWithBlobStatus,
      verifiedReports: verifiedReports,
      verifiedReportsWithBlob: verifiedReportsWithBlob,
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({ error: error.message });
  }
}

// Function to clear existing test reports
async function clearTestReports(req, res) {
  try {
    const customerIdentifier = req.customerName;
    const customerKey = getCustomerKey(customerIdentifier);

    if (!customerKey) {
      return res.status(403).json({ error: "Customer not recognized" });
    }

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    // Delete all reports for this customer
    const result = await ReportStatus.deleteMany({
      customerKey: customerKey,
    });

    console.log(
      `Cleared ${result.deletedCount} existing reports for customer ${customerKey}`
    );

    res.json({
      message: `Cleared ${result.deletedCount} existing reports`,
      customerKey,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing test reports:", error);
    res.status(500).json({ error: error.message });
  }
}

// Function to create a test report with the CORRECT blob structure
async function createTestReport(req, res) {
  try {
    const customerIdentifier = req.customerName;
    const customerKey = getCustomerKey(customerIdentifier);
    const customerDisplayName = getCustomerDisplayName(customerKey);

    if (!customerKey) {
      return res.status(403).json({ error: "Customer not recognized" });
    }

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    // Create a test report for the current month
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthShort = now
      .toLocaleString("default", { month: "short" })
      .toLowerCase();

    const reportId = `${customerKey}_${month}_${year}`;

    // Create blob path matching your actual structure
    const blobPath = `${customerKey}/${year}/${monthShort}/${customerKey}_Monthly_Report_${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}_${year}.pdf`;

    // IMPORTANT: Use the CORRECT blob URL with your actual account name
    const blobUrl = `https://socwatchtowerreports.blob.core.windows.net/customerreports/${blobPath}`;

    // Check if the blob actually exists before marking as verified
    const blobExists = await checkBlobExists(blobPath);

    const testReport = {
      reportId,
      customerKey,
      customerDisplayName,
      month,
      year,
      status: blobExists ? "verified" : "uploaded", // Only mark as verified if blob exists
      blobUrl,
      blobPath,
      fileSize: 1024000, // 1MB
      verifiedAt: blobExists ? new Date() : undefined,
    };

    console.log("Creating test report with URL:", blobUrl);
    console.log("Blob exists:", blobExists);

    await ReportStatus.findOneAndUpdate({ reportId }, testReport, {
      upsert: true,
      new: true,
    });

    console.log("Created test report:", testReport);

    res.json({
      message: "Test report created",
      report: testReport,
      blobExists,
    });
  } catch (error) {
    console.error("Error creating test report:", error);
    res.status(500).json({ error: error.message });
  }
}

// Function to create multiple test reports for different months
async function createMultipleTestReports(req, res) {
  try {
    const customerIdentifier = req.customerName;
    const customerKey = getCustomerKey(customerIdentifier);
    const customerDisplayName = getCustomerDisplayName(customerKey);

    if (!customerKey) {
      return res.status(403).json({ error: "Customer not recognized" });
    }

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();
    const createdReports = [];

    // Create test reports for past 5 months (excluding current month)
    for (let i = 1; i <= 5; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthShort = date
        .toLocaleString("default", { month: "short" })
        .toLowerCase();

      const reportId = `${customerKey}_${month}_${year}`;

      // Create blob path matching your actual structure
      const blobPath = `${customerKey}/${year}/${monthShort}/${customerKey}_Monthly_Report_${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}_${year}.pdf`;

      // Create blob URL matching your actual structure with correct account name
      const blobUrl = `https://socwatchtowerreports.blob.core.windows.net/customerreports/${blobPath}`;

      // Check if the blob actually exists before marking as verified
      const blobExists = await checkBlobExists(blobPath);

      const testReport = {
        reportId,
        customerKey,
        customerDisplayName,
        month,
        year,
        status: blobExists ? "verified" : "uploaded", // Only mark as verified if blob exists
        blobUrl,
        blobPath,
        fileSize: 1024000 + i * 500000, // Varying file sizes
        verifiedAt: blobExists ? new Date() : undefined,
      };

      console.log(
        `Creating test report for ${monthShort} ${year} with URL:`,
        blobUrl
      );
      console.log(`Blob exists: ${blobExists}`);

      await ReportStatus.findOneAndUpdate({ reportId }, testReport, {
        upsert: true,
        new: true,
      });

      createdReports.push(testReport);
    }

    console.log("Created multiple test reports:", createdReports.length);

    res.json({
      message: `Created ${createdReports.length} test reports for past 5 months`,
      reports: createdReports,
    });
  } catch (error) {
    console.error("Error creating multiple test reports:", error);
    res.status(500).json({ error: error.message });
  }
}

// Function to manually create a test report with the exact customer key
async function createManualTestReport(req, res) {
  try {
    const customerIdentifier = req.customerName;
    const customerKey = getCustomerKey(customerIdentifier);
    const customerDisplayName = getCustomerDisplayName(customerKey);

    if (!customerKey) {
      return res.status(403).json({ error: "Customer not recognized" });
    }

    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();
    
    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    // Create a test report for the current month
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthShort = now
      .toLocaleString("default", { month: "short" })
      .toLowerCase();

    const reportId = `${customerKey}_${month}_${year}`;

    // Create blob path matching your actual structure
    const blobPath = `${customerKey}/${year}/${monthShort}/${customerKey}_Monthly_Report_${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}_${year}.pdf`;

    // IMPORTANT: Use the CORRECT blob URL with your actual account name
    const blobUrl = `https://socwatchtowerreports.blob.core.windows.net/customerreports/${blobPath}`;

    // Check if the blob actually exists before marking as verified
    const blobExists = await checkBlobExists(blobPath);

    const testReport = {
      reportId,
      customerKey,
      customerDisplayName,
      month,
      year,
      status: blobExists ? "verified" : "uploaded", // Only mark as verified if blob exists
      blobUrl,
      blobPath,
      fileSize: 1024000, // 1MB
      verifiedAt: blobExists ? new Date() : undefined,
    };

    console.log("Creating manual test report with URL:", blobUrl);
    console.log("Blob exists:", blobExists);

    // First, try to find if the report already exists
    const existingReport = await ReportStatus.findOne({ reportId });
    console.log("Existing report:", existingReport);

    // Create or update the report
    const savedReport = await ReportStatus.findOneAndUpdate({ reportId }, testReport, {
      upsert: true,
      new: true,
    });

    console.log("Saved report:", savedReport);

    // Verify it was saved by finding it again
    const verifiedReport = await ReportStatus.findOne({ reportId });
    console.log("Verified saved report:", verifiedReport);

    res.json({
      message: "Manual test report created",
      report: savedReport,
      verifiedReport,
      blobExists,
    });
  } catch (error) {
    console.error("Error creating manual test report:", error);
    res.status(500).json({ error: error.message });
  }
}

// Function to check other databases for customer data
async function checkOtherDatabases(req, res) {
  try {
    console.log("=== CHECKING OTHER DATABASES ===");
    
    const customerIdentifier = req.customerName;
    const customerKey = getCustomerKey(customerIdentifier);
    
    // List of candidate databases to check
    const candidateDatabases = ['reports_db', 'socwatchtower', 'test', 'sharddb'];
    const results = {};
    
    for (const dbName of candidateDatabases) {
      try {
        console.log(`\n--- Checking database: ${dbName} ---`);
        
        // Temporarily switch to other database
        const otherDb = mongoose.connection.useDb(dbName);
        
        // Get the 'reportstatuses' collection from that database
        const collection = otherDb.collection('reportstatuses');
        
        // Check if the collection exists and count documents for our customer
        const count = await collection.countDocuments({ customerKey: customerKey });
        
        // If we find documents, get the details
        let reports = [];
        if (count > 0) {
          reports = await collection.find({ customerKey: customerKey }).toArray();
        }
        
        results[dbName] = {
          accessible: true,
          reportCount: count,
          reports: reports
        };
        
        console.log(`Found ${count} reports for ${customerKey} in ${dbName}`);
        
      } catch (error) {
        console.log(`Error accessing ${dbName}: ${error.message}`);
        results[dbName] = {
          accessible: false,
          error: error.message
        };
      }
    }
    
    res.json({
      currentDatabase: mongoose.connection.name,
      customerKey,
      results
    });
    
  } catch (error) {
    console.error("Error checking other databases:", error);
    res.status(500).json({ error: error.message });
  }
}

export {
  getReportSasUrl,
  getAvailableReportsForCustomer,
  debugReports,
  clearTestReports,
  createTestReport,
  createMultipleTestReports,
  createManualTestReport,
  checkOtherDatabases,
  initializeReportsDBConnection, // Export for potential initialization in app startup
};