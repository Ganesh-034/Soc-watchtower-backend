import {
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { BlobServiceClient } from "@azure/storage-blob";
import mongoose from "mongoose";
import logger from "../config/logger.js";

// Default connection (for other operations)
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

      reportsDBConnection.on("connected", () => {
        logger.info("✅ Reports database connected successfully");
      });

      reportsDBConnection.on("error", (err) => {
        logger.error("❌ Reports database connection error:", err);
      });

      reportsDBConnection.on("disconnected", () => {
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
  "Hino Motor- HMST": "Hino Motor Sales Thailand HMST",
  "centralmotorwheel-thailand": "Centralmotorwheel Thailand",
  "PT.RKNForge": "PT RKN Forge Indonesia",
  "taiho-thailand": "Taiho Thailand",
};
// Helper function to get customer key from either key or display name
function getCustomerKey(customerIdentifier) {
  logger.info(
    `🔍 Looking up customer key for identifier: "${customerIdentifier}"`
  );

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
      logger.info(
        `✅ Found reverse match: "${customerIdentifier}" -> "${key}"`
      );
      return key;
    }
  }

  logger.warn(
    `❌ No match found for customer identifier: "${customerIdentifier}"`
  );
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
    throw new Error(
      "Reports database connection not initialized. Call initializeReportsDBConnection() first."
    );
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

    // DO NOT encode segments; Azure expects the raw blob name as stored
    logger.info(`🔐 Using normalized blob path: "${normalized}"`);

    const blobClient = containerClient.getBlobClient(normalized);
    const exists = await blobClient.exists();

    logger.info(`📦 Blob exists result: ${exists}`);
    return exists;
  } catch (error) {
    logger.error(`❌ Error checking if blob exists: ${blobPath}`, error);
    return false;
  }
}

// SOLUTION 1: Function to check if a report already exists (in database and blob storage)
async function checkReportExists(customerKey, month, year) {
  try {
    // Initialize reports DB connection if needed
    await initializeReportsDBConnection();

    // Get the ReportStatus model from reports DB
    const ReportStatus = getReportsStatusModel();

    const reportId = `${customerKey}_${month}_${year}`;

    // Check if report exists in database
    const report = await ReportStatus.findOne({ reportId });

    if (!report) {
      logger.info(`📄 Report ${reportId} not found in database`);
      return { exists: false, reason: "Not in database" };
    }

    // If report exists, check if blob exists
    if (!report.blobPath) {
      logger.warn(`⚠️ Report ${reportId} found in database but no blob path`);
      return { exists: false, reason: "No blob path in database" };
    }

    const blobExists = await checkBlobExists(report.blobPath);

    if (!blobExists) {
      logger.warn(`⚠️ Report ${reportId} found in database but blob not found`);
      return { exists: false, reason: "Blob not found" };
    }

    logger.info(`✅ Report ${reportId} exists in database and blob storage`);
    return { exists: true, report };
  } catch (error) {
    logger.error(`❌ Error checking if report exists: ${error.message}`);
    return { exists: false, reason: "Error checking" };
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
      logger.error(
        `❌ Missing required parameters: month=${month}, year=${year}`
      );
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
      logger.error(
        `❌ Report not ready for download. Status: "${report.status}"`
      );
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
    const pathParts = blobUrl.pathname.split("/");

    // The first part after the hostname is the container name
    const containerName = pathParts[1];

    // The rest is the blob path (including folders), decode if needed
    const blobName = decodeURIComponent(pathParts.slice(2).join("/"));

    logger.info(`🔐 Container: "${containerName}", Blob: "${blobName}"`);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: containerName,
        blobName: blobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: sasExpiresOn,
      },
      new StorageSharedKeyCredential(
        process.env.AZURE_STORAGE_ACCOUNT_NAME,
        process.env.AZURE_STORAGE_ACCOUNT_KEY
      )
    );

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

// SOLUTION 2: Function to generate SAS URL directly from blob path (for your one-time manual upload)
// This updated version finds the file automatically in the folder.
async function getDirectSasUrl(req, res) {
  try {
    logger.info("🚀 [getDirectSasUrl] Called");

    const customerIdentifier = req.customerName;
    logger.info(`🔑 [getDirectSasUrl] Customer identifier: "${customerIdentifier}"`);
    const customerKey = getCustomerKey(customerIdentifier);

    if (!customerKey) {
      logger.warn(`❌ [getDirectSasUrl] Customer not recognized: "${customerIdentifier}"`);
      return res.status(403).json({ error: "Customer not recognized" });
    }

    const { month, year } = req.params;
    logger.info(`[getDirectSasUrl] Request params: month=${month}, year=${year}`);

    if (!month || !year) {
      logger.warn(`❌ [getDirectSasUrl] Missing required parameters: month=${month}, year=${year}`);
      return res.status(400).json({
        error: "Missing required parameters: month, year",
      });
    }

    // Create folder prefix based on expected structure
    const monthShort = new Date(year, month - 1)
      .toLocaleString("default", { month: "short" })
      .toLowerCase();

    const folderPrefix = `${customerKey}/${year}/${monthShort}/`;
    logger.info(`🔍 [getDirectSasUrl] Searching for PDF in folder: ${folderPrefix}`);

    // Find the first PDF file in that folder
    let blobName = null;
    for await (const blob of containerClient.listBlobsFlat({ prefix: folderPrefix })) {
      logger.info(`🔍 [getDirectSasUrl] Found blob: ${blob.name}`);
      if (blob.name.endsWith(".pdf")) {
        blobName = blob.name;
        logger.info(`✅ [getDirectSasUrl] PDF found: ${blobName}`);
        break;
      }
    }

    if (!blobName) {
      logger.warn(`❌ [getDirectSasUrl] No PDF found in folder: ${folderPrefix}`);
      return res.status(404).json({
        error: `No PDF report found in folder: ${folderPrefix}`,
      });
    }

    // Construct blob URL
    const blobUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_CONTAINER_NAME}/${blobName}`;
    logger.info(`[getDirectSasUrl] Blob URL: ${blobUrl}`);

    // SAS expiration time (1 hour)
    const sasExpiresOn = new Date();
    sasExpiresOn.setMinutes(sasExpiresOn.getMinutes() + 60);

    // Parse blob URL to extract container and blob name
    const blobUrlObj = new URL(blobUrl);
    const pathParts = blobUrlObj.pathname.split("/");

    const containerName = pathParts[1]; // should be your container name
    const fullBlobName = decodeURIComponent(pathParts.slice(2).join("/")); // decode to match exact blob name

    logger.info(`🔐 [getDirectSasUrl] Generating SAS for container: "${containerName}", blob: "${fullBlobName}"`);

    // Generate SAS token
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: fullBlobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: sasExpiresOn,
      },
      new StorageSharedKeyCredential(
        process.env.AZURE_STORAGE_ACCOUNT_NAME,
        process.env.AZURE_STORAGE_ACCOUNT_KEY
      )
    );

    const sasUrl = `${blobUrl}?${sasToken}`;
    logger.info(`🔗 [getDirectSasUrl] Generated direct SAS URL for ${blobName}`);

    // Extract filename for response
    const fileName = blobName.split("/").pop();

    logger.info(`[getDirectSasUrl] Responding with fileName: "${fileName}", expiresOn: ${sasExpiresOn}`);

    res.json({
      downloadUrl: sasUrl,
      fileName,
      expiresOn: sasExpiresOn,
      customerKey,
      blobPath: blobName,
    });
  } catch (error) {
    logger.error("❌ [getDirectSasUrl] Error generating direct SAS URL:", error);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
}

// Function to get all available reports for the authenticated user's customer
// Helper function to get past N months (excluding current month)
function getPastMonths(count = 5) {
  const now = new Date();
  const months = [];
  for (let i = 1; i <= count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: date.getMonth() + 1, year: date.getFullYear() });
  }
  return months;
}

// Function to get available reports for the authenticated user's customer (past 5 months only)
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

    // Get past 5 months (excluding current month)
    const pastMonths = getPastMonths(5);

    // Build query for those months/years
    const orConditions = pastMonths.map(({ month, year }) => ({
      month,
      year,
    }));

    logger.info(
      `🔍 Searching for verified reports for customer: "${customerKey}" in past 5 months`
    );
    const reports = await ReportStatus.find({
      customerKey,
      status: "verified",
      $or: orConditions,
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
    const savedReport = await ReportStatus.findOneAndUpdate(
      { reportId },
      testReport,
      {
        upsert: true,
        new: true,
      }
    );

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


export {
  getReportSasUrl,
  getAvailableReportsForCustomer,
  debugReports,
  clearTestReports,
  createTestReport,
  createMultipleTestReports,
  createManualTestReport,
  initializeReportsDBConnection, // Export for potential initialization in app startup
  checkReportExists, // For preventing duplicate generation
  getDirectSasUrl, // For your one-time manual upload
};
