import { BlobSASPermissions, StorageSharedKeyCredential, generateBlobSASQueryParameters } from "@azure/storage-blob";
import { BlobServiceClient } from "@azure/storage-blob";
import mongoose from "mongoose";
import logger from "../config/logger.js";

// Azure Blob Storage configuration
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
);
const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);

// Customer configuration - bidirectional mapping
const customers = {
  // Key to display name
  "toyotatsushoapacsoc": "Toyota Tsusho Asia Pacific",
  "centralmotorwheel-thailand": "Centralmotorwheel Thailand",
  "taiho-thailand": "Taiho Thailand",
  
  // Display name to key (for reverse lookup)
  "Toyota Tsusho Asia Pacific": "toyotatsushoapacsoc",
  "Centralmotorwheel Thailand": "centralmotorwheel-thailand",
  "Taiho Thailand": "taiho-thailand",
};

// Helper function to get customer key from either key or display name
function getCustomerKey(customerIdentifier) {
  // If it's already a key (from token), return it
  if (customers[customerIdentifier] && typeof customers[customerIdentifier] === 'string') {
    return customerIdentifier;
  }
  
  // If it's a display name, return the corresponding key
  for (const [key, value] of Object.entries(customers)) {
    if (value === customerIdentifier) {
      return key;
    }
  }
  
  return null;
}

// Helper function to get customer display name from key
function getCustomerDisplayName(customerKey) {
  return customers[customerKey] || "Unknown Customer";
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
    enum: ['queued', 'generating', 'generated', 'uploading', 'uploaded', 'verified', 'failed', 'retrying'],
    default: 'queued'
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
  verifiedAt: { type: Date }
});

// Helper function to get ReportStatus model
function getReportStatusModel() {
  if (mongoose.models.ReportStatus) {
    return mongoose.models.ReportStatus;
  }
  
  return mongoose.model('ReportStatus', ReportStatusSchema);
}

// Function to generate SAS URL for a specific report
async function getReportSasUrl(req, res) {
  try {
    const { month, year } = req.params;
    
    // Get customer identifier from the authenticated request
    const customerIdentifier = req.customerName;
    
    if (!customerIdentifier) {
      return res.status(403).json({ error: "Customer information not available" });
    }
    
    // Get customer key from identifier
    const customerKey = getCustomerKey(customerIdentifier);
    
    if (!customerKey) {
      return res.status(403).json({ error: "Customer not recognized" });
    }
    
    // Get display name
    const customerDisplayName = getCustomerDisplayName(customerKey);
    
    // Validate parameters
    if (!month || !year) {
      return res.status(400).json({ error: "Missing required parameters: month, year" });
    }
    
    const reportId = `${customerKey}_${month}_${year}`;
    
    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();
    
    // Find the report in the database
    const report = await ReportStatus.findOne({ reportId });
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    if (report.status !== 'verified') {
      return res.status(400).json({ 
        error: "Report is not ready for download",
        status: report.status 
      });
    }
    
    // Create SAS token that's valid for 1 hour
    const sasExpiresOn = new Date();
    sasExpiresOn.setMinutes(sasExpiresOn.getMinutes() + 60);
    
    // Generate SAS token
    const sasToken = generateBlobSASQueryParameters({
      containerName: process.env.AZURE_CONTAINER_NAME,
      blobName: report.blobPath,
      permissions: BlobSASPermissions.parse("r"), // Read permission
      expiresOn: sasExpiresOn
    }, 
    new StorageSharedKeyCredential(
      process.env.AZURE_STORAGE_ACCOUNT_NAME,
      process.env.AZURE_STORAGE_ACCOUNT_KEY
    ));
    
    // Construct SAS URL
    const sasUrl = `${report.blobUrl}?${sasToken}`;
    
    // Log the download request for audit purposes
    logger.info(`🔑 Generated SAS URL for report ${reportId} for customer ${customerDisplayName}`);
    
    res.json({
      downloadUrl: sasUrl,
      fileName: `${customerKey}_Monthly_Report_${month}_${year}.pdf`,
      expiresOn: sasExpiresOn,
      customerKey, // Return for frontend display
      customerDisplayName
    });
    
  } catch (error) {
    logger.error("❌ Error generating SAS URL:", error);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
}

// Function to get all available reports for the authenticated user's customer
async function getAvailableReportsForCustomer(req, res) {
  try {
    // Get customer identifier from the authenticated request
    const customerIdentifier = req.customerName;
    
    if (!customerIdentifier) {
      return res.status(403).json({ error: "Customer information not available" });
    }
    
    // Get customer key from identifier
    const customerKey = getCustomerKey(customerIdentifier);
    
    if (!customerKey) {
      return res.status(403).json({ error: "Customer not recognized" });
    }
    
    // Get display name
    const customerDisplayName = getCustomerDisplayName(customerKey);
    
    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();
    
    // Find all verified reports for this customer
    const reports = await ReportStatus.find({ 
      customerKey,
      status: 'verified'
    }).sort({ year: -1, month: -1 });
    
    // Format the response
    const formattedReports = reports.map(report => ({
      reportId: report.reportId,
      customerKey: report.customerKey,
      customerDisplayName: report.customerDisplayName,
      month: report.month,
      year: report.year,
      blobUrl: report.blobUrl,
      blobPath: report.blobPath,
      fileSize: report.fileSize,
      createdAt: report.createdAt,
      verifiedAt: report.verifiedAt
    }));
    
    res.json({
      customerKey,
      customerDisplayName,
      reports: formattedReports
    });
    
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
    
    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();
    
    // Find ALL reports for this customer (not just verified)
    const allReports = await ReportStatus.find({ 
      customerKey: customerKey || 'unknown'
    });
    
    console.log("All reports for customer:", allReports.length);
    allReports.forEach(report => {
      console.log(`- ${report.reportId}: ${report.status} (${report.month}/${report.year})`);
      console.log(`  Blob URL: ${report.blobUrl}`);
      console.log(`  Blob Path: ${report.blobPath}`);
    });
    
    // Find only verified reports
    const verifiedReports = await ReportStatus.find({ 
      customerKey: customerKey || 'unknown',
      status: 'verified'
    });
    
    console.log("Verified reports for customer:", verifiedReports.length);
    
    res.json({
      customerIdentifier,
      customerKey,
      customerDisplayName,
      totalReports: allReports.length,
      verifiedReports: verifiedReports.length,
      allReports: allReports,
      verifiedReports: verifiedReports
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
    
    const ReportStatus = getReportStatusModel();
    
    // Delete all reports for this customer
    const result = await ReportStatus.deleteMany({ 
      customerKey: customerKey
    });
    
    console.log(`Cleared ${result.deletedCount} existing reports for customer ${customerKey}`);
    
    res.json({ 
      message: `Cleared ${result.deletedCount} existing reports`,
      customerKey,
      deletedCount: result.deletedCount
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
    
    const ReportStatus = getReportStatusModel();
    
    // Create a test report for the current month
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthShort = now.toLocaleString('default', { month: 'short' }).toLowerCase();
    
    const reportId = `${customerKey}_${month}_${year}`;
    
    // Create blob path matching your actual structure
    const blobPath = `${customerKey}/${year}/${monthShort}/${customerKey}_Monthly_Report_${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}_${year}.pdf`;
    
    // IMPORTANT: Use the CORRECT blob URL with your actual account name
    const blobUrl = `https://socwatchtowerreports.blob.core.windows.net/customerreports/${blobPath}`;
    
    const testReport = {
      reportId,
      customerKey,
      customerDisplayName,
      month,
      year,
      status: 'verified',
      blobUrl,
      blobPath,
      fileSize: 1024000, // 1MB
      verifiedAt: new Date()
    };
    
    console.log("Creating test report with URL:", blobUrl);
    
    await ReportStatus.findOneAndUpdate(
      { reportId },
      testReport,
      { upsert: true, new: true }
    );
    
    console.log("Created test report:", testReport);
    
    res.json({ 
      message: "Test report created",
      report: testReport
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
    
    const ReportStatus = getReportStatusModel();
    const createdReports = [];
    
    // Create test reports for past 5 months (excluding current month)
    for (let i = 1; i <= 5; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthShort = date.toLocaleString('default', { month: 'short' }).toLowerCase();
      
      const reportId = `${customerKey}_${month}_${year}`;
      
      // Create blob path matching your actual structure
      const blobPath = `${customerKey}/${year}/${monthShort}/${customerKey}_Monthly_Report_${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}_${year}.pdf`;
      
      // Create blob URL matching your actual structure with correct account name
      const blobUrl = `https://socwatchtowerreports.blob.core.windows.net/customerreports/${blobPath}`;
      
      const testReport = {
        reportId,
        customerKey,
        customerDisplayName,
        month,
        year,
        status: 'verified',
        blobUrl,
        blobPath,
        fileSize: 1024000 + (i * 500000), // Varying file sizes
        verifiedAt: new Date()
      };
      
      console.log(`Creating test report for ${monthShort} ${year} with URL:`, blobUrl);
      
      await ReportStatus.findOneAndUpdate(
        { reportId },
        testReport,
        { upsert: true, new: true }
      );
      
      createdReports.push(testReport);
    }
    
    console.log("Created multiple test reports:", createdReports.length);
    
    res.json({ 
      message: `Created ${createdReports.length} test reports for past 5 months`,
      reports: createdReports
    });
    
  } catch (error) {
    console.error("Error creating multiple test reports:", error);
    res.status(500).json({ error: error.message });
  }
}

export {
  getReportSasUrl,
  getAvailableReportsForCustomer,
  debugReports,
  clearTestReports,
  createTestReport,
  createMultipleTestReports
};