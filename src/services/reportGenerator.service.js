import puppeteer from "puppeteer";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import schedule from "node-schedule";
import { BlobServiceClient } from "@azure/storage-blob";
import EventEmitter from "events";
import mongoose from "mongoose";
import crypto from "crypto";
import * as incidentService from "./incident.severity.service.js";
import * as incidentDSService from "./incidentDS.service.js";
import * as incidentHSService from "./incidentHS.service.js";
import * as incidentSSService from "./incidentSS.service.js";
import logger from "../config/logger.js";
import Incident from "../models/incident.model.js";
import { generateExecutiveSummary } from "./executiveSummary.service.js";
import { generateTicketSummary } from "./ticketSummary.service.js";
import { stripHtmlTags } from "../utils/sanitizeHtml.js";
// Customer configuration

const customers = {
  "Hino Motor- HMST": "Hino Motor Sales Thailand HMST",
  "centralmotorwheel-thailand": "Centralmotorwheel Thailand",
  "PT.RKNForge": "PT RKN Forge Indonesia",
  "taiho-thailand": "Taiho Thailand",
};

// Azure Blob Storage configuration
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME
);

// Event emitter for real-time tracking
const reportGenerationEvents = new EventEmitter();

// Reports database connection
let reportsDBConnection;

// Connection state tracking
let isReportsDBConnecting = false;
let isReportsDBConnected = false;

// Define ReportStatus schema and model
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
  queuedAt: { type: Date },
  generatingAt: { type: Date },
  generatedAt: { type: Date },
  uploadingAt: { type: Date },
  uploadedAt: { type: Date },
  verifiedAt: { type: Date },
  failedAt: { type: Date },
  retryingAt: { type: Date },
  fileSize: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Helper function to get the ReportStatus model
function getReportStatusModel() {
  if (!reportsDBConnection) {
    throw new Error("Reports database connection is not established");
  }

  // Return the model if it already exists
  if (reportsDBConnection.models.ReportStatus) {
    return reportsDBConnection.models.ReportStatus;
  }

  // Otherwise create and return the model
  return reportsDBConnection.model("ReportStatus", ReportStatusSchema);
}

// Function to establish a connection to the reports database
export const connectReportsDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MongoDB URI not configured");
    }

    // Prevent multiple connection attempts
    if (isReportsDBConnecting) {
      logger.info(
        "⏳️ Reports database connection already in progress, skipping..."
      );
      return reportsDBConnection;
    }

    isReportsDBConnecting = true;

    logger.info("🔌 Attempting to connect to Reports MongoDB...");
    logger.info(
      `Connection URI: ${process.env.MONGODB_URI.replace(/:([^:]+)@/, ":***@")}`
    ); // Hide password in logs

    // Create a new connection for the reports database with updated options
    reportsDBConnection = await mongoose.createConnection(
      process.env.MONGODB_URI,
      {
        dbName: "reports_db", // Explicitly set the database name
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        // Removed deprecated options: bufferMaxEntries, bufferCommands, useNewUrlParser, useUnifiedTopology
      }
    );

    // Wait for connection to be fully established
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 30000); // 30 second timeout

      reportsDBConnection.once("open", () => {
        clearTimeout(timeout);
        isReportsDBConnecting = false;
        isReportsDBConnected = true;
        logger.info("✅ Reports MongoDB connection opened successfully");
        logger.info(
          `✅ Reports MongoDB connection state: ${reportsDBConnection.readyState}`
        );
        logger.info(
          `✅ Reports MongoDB connected to ${reportsDBConnection.name}`
        );

        // Initialize the database after connection is ready
        setTimeout(() => {
          initializeReportsDatabase()
            .then(() => {
              resolve();
            })
            .catch((err) => {
              logger.error("❌ Failed to initialize reports database:", err);
              reject(err);
            });
        }, 1000); // Small delay to ensure connection is fully established
      });

      reportsDBConnection.once("error", (err) => {
        clearTimeout(timeout);
        isReportsDBConnecting = false;
        isReportsDBConnected = false;
        logger.error("❌ Reports MongoDB connection error:", err);
        reject(err);
      });
    });

    // Set up event handlers
    reportsDBConnection.on("connecting", () => {
      logger.info("🔌 Reports MongoDB connecting...");
    });

    reportsDBConnection.on("connected", () => {
      logger.info("✅ Reports MongoDB connected");
      isReportsDBConnected = true;
    });

    reportsDBConnection.on("disconnecting", () => {
      logger.info("🔌 Reports MongoDB disconnecting...");
      isReportsDBConnected = false;
    });

    reportsDBConnection.on("disconnected", () => {
      logger.warn(
        "⚠️ Reports MongoDB disconnected, attempting to reconnect..."
      );

      // Try to reconnect after a delay
      setTimeout(async () => {
        try {
          await connectReportsDB();
          logger.info("✅ Reports MongoDB reconnected successfully");
        } catch (error) {
          logger.error("❌ Failed to reconnect to Reports MongoDB:", error);
        }
      }, 5000); // Wait 5 seconds before attempting to reconnect
    });

    reportsDBConnection.on("reconnected", () => {
      logger.info("✅ Reports MongoDB reconnected");
      isReportsDBConnected = true;
    });

    return reportsDBConnection;
  } catch (error) {
    logger.error(`Error connecting to Reports MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Simplified initialize function
async function initializeReportsDatabase() {
  try {
    // Wait a bit to ensure connection is fully established
    if (!isReportsDBConnected) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();

    // Create indexes with error handling
    try {
      await ReportStatus.createIndexes();
      logger.info("✅ Reports database indexes created successfully");
    } catch (indexError) {
      // Log error but don't fail - indexes might already exist
      logger.warn(
        "⚠️ Warning creating indexes (may already exist):",
        indexError.message
      );
    }

    logger.info("✅ Reports database initialized successfully");
    return true;
  } catch (error) {
    logger.error("❌ Failed to initialize reports database:", error);
    return false;
  }
}

// Helper function to update report status in the database
async function updateReportStatus(reportId, updateData) {
  try {
    // Check if reports database connection is ready
    if (!isReportsDBConnected) {
      logger.error("❌ Reports database connection is not ready");
      throw new Error("Reports database connection is not ready");
    }

    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();

    // Ensure status is explicitly provided
    const status = updateData.status;
    if (status) {
      logger.info(`🔄 Updating status for report ${reportId} to ${status}`);
    }

    // Create the update object with proper timestamp fields
    const updateObject = { ...updateData, updatedAt: new Date() };

    // Add specific timestamp fields based on status
    if (status === "queued") updateObject.queuedAt = new Date();
    if (status === "generating") updateObject.generatingAt = new Date();
    if (status === "generated") updateObject.generatedAt = new Date();
    if (status === "uploading") updateObject.uploadingAt = new Date();
    if (status === "uploaded") updateObject.uploadedAt = new Date();
    if (status === "verified") updateObject.verifiedAt = new Date();
    if (status === "failed") updateObject.failedAt = new Date();
    if (status === "retrying") updateObject.retryingAt = new Date();

    // Clear error field when status is not 'failed'
    if (status && status !== "failed") {
      updateObject.$unset = { error: 1 };
    }

    const result = await ReportStatus.findOneAndUpdate(
      { reportId },
      updateObject,
      { upsert: true, new: true, returnDocument: "after" }
    );

    logger.info(
      `✅ Updated status for report ${reportId}: ${status || "no status provided"}`
    );
    return result;
  } catch (error) {
    logger.error(`❌ Failed to update status for report ${reportId}:`, error);
    throw error;
  }
}

// Helper function to get all report statuses
async function getAllReportStatuses() {
  try {
    // Check if reports database connection is ready
    if (!isReportsDBConnected) {
      logger.error("❌ Reports database connection is not ready");
      throw new Error("Reports database connection is not ready");
    }

    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();

    return await ReportStatus.find().sort({ createdAt: -1 });
  } catch (error) {
    logger.error("❌ Failed to get report statuses:", error);
    throw error;
  }
}

// Helper function to calculate file checksum
function calculateChecksum(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("md5"); // Use MD5 to match Azure's contentMD5
    hash.update(fileBuffer);
    return hash.digest("hex");
  } catch (error) {
    logger.error(`❌ Error calculating checksum for ${filePath}:`, error);
    throw error;
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on("error", reject);
  });
}

// Helper function to verify blob existence and checksum
async function verifyBlob(blobPath, expectedChecksum) {
  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    const exists = await blockBlobClient.exists();

    if (!exists) {
      logger.error(`❌ Blob does not exist: ${blobPath}`);
      return false;
    }

    // If checksum is provided, verify it
    if (expectedChecksum) {
      const properties = await blockBlobClient.getProperties();

      // Check multiple possible locations for MD5 hash
      let blobChecksum = null;

      // Try contentSettings.contentMD5
      if (properties.contentSettings && properties.contentSettings.contentMD5) {
        blobChecksum = Buffer.from(
          properties.contentSettings.contentMD5
        ).toString("hex");
      }
      // Try properties.contentMD5 directly
      else if (properties.contentMD5) {
        blobChecksum = Buffer.from(properties.contentMD5).toString("hex");
      }
      // Try metadata.checksum
      else if (properties.metadata && properties.metadata.checksum) {
        blobChecksum = properties.metadata.checksum;
      }
      // If none of the above work, we need to download and calculate
      else {
        logger.warn(
          `⚠️ Could not find checksum in blob properties for ${blobPath}, downloading to verify`
        );

        // Download the blob content and calculate checksum
        const response = await blockBlobClient.download();
        const content = response.readableStreamBody
          ? await streamToBuffer(response.readableStreamBody)
          : Buffer.alloc(0);
        blobChecksum = crypto.createHash("md5").update(content).digest("hex");
      }

      if (blobChecksum !== expectedChecksum) {
        logger.error(
          `❌ Checksum mismatch for ${blobPath}. Expected: ${expectedChecksum}, Actual: ${blobChecksum}`
        );
        return false;
      }
    }

    logger.info(`✅ Verified blob: ${blobPath}`);
    return true;
  } catch (error) {
    logger.error(`❌ Error verifying blob ${blobPath}:`, error);
    return false;
  }
}

// Helper function to upload a file to Azure Blob Storage with verification
async function uploadToBlobStorage(
  filePath,
  blobName,
  expectedChecksum = null
) {
  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const fileContent = fs.readFileSync(filePath);

    // Calculate MD5 checksum for both contentMD5 and metadata
    const md5Checksum = crypto.createHash("md5").update(fileContent).digest();
    const md5ChecksumHex = md5Checksum.toString("hex");

    // Use the provided checksum or calculate a new one
    const checksum = expectedChecksum || md5ChecksumHex;

    await blockBlobClient.upload(fileContent, fileContent.length, {
      metadata: {
        checksum: checksum, // Store MD5 checksum in metadata
        uploadedAt: new Date().toISOString(),
      },
      contentSettings: {
        contentMD5: md5Checksum, // Set MD5 checksum for content verification
      },
    });

    // Get the URL of the uploaded blob
    const blobUrl = blockBlobClient.url;
    logger.info(
      `✅ Successfully uploaded ${blobName} to Azure Blob Storage: ${blobUrl}`
    );

    // Clean up the local file after successful upload
    fs.unlinkSync(filePath);

    return { blobUrl, blobPath: blobName };
  } catch (error) {
    logger.error(`❌ Error uploading to Blob Storage: ${error.message}`);
    throw error;
  }
}

// Helper function to format ticket data (moved from controller for reuse)
const formatTicket = (ticket) => ({
  id: ticket._id || "NA",
  subject: ticket.subject || "NA",
  status: mapStatus(ticket.status),
  priority: ticket.priority || "NA",
  socAnalysis: ticket.soc_analysis || "NA",
  socRecommendation: ticket.soc_recommendation || "NA",
  sentinelIncidentNumber: ticket.sentinel_incident_number || "NA",
  ttps: ticket.ttps || "NA",
  description: stripHtmlTags(ticket.description) || "NA",
  incidentType: ticket.incident_type || "NA",
  incidentSubStatus: ticket.incident_sub_status || "NA",
  createdDate: ticket.created_at || "NA",
  updatedDate: ticket.updated_at || "NA",
  agentName: ticket.agent_name || "NA",
  customerName: ticket.customer_name || "NA",
  customerId: ticket.responder_id || "NA",
  customerSubLocation: ticket.customer_sub_location || "NA",
  resolvedBy: ticket.resolved_by || "NA",
  customerEscalation: ticket.customer_escalation || "NA",
});

// Helper function to map status codes to readable strings
function mapStatus(statusCode) {
  if (statusCode == null) return "NA";

  const statusMap = {
    2: "Open",
    3: "Pending",
    4: "Resolved",
    5: "Closed",
    6: "Escalated",
  };
  return statusMap[statusCode] || `Unknown (${statusCode})`;
}

// =============================================================================
// NEW HELPERS FROM CODE 2 (For "All Incidents" Logic)
// =============================================================================

// Helper to get UTC month window (used for precise date filtering)
function getMonthWindowUTC(year, month /* 1-based */) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const nextStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, nextStart };
}

// Function to get Health Incidents (ALL) - for Hino
const getHealthIncidentsAll = async (customerName, month, year) => {
  try {
    const { start, nextStart } = getMonthWindowUTC(year, month);
    const filters = {
      customer_name: customerName,
      incident_type: "Health Incident",
      $expr: {
        $and: [
          { $gte: [{ $toDate: "$created_at" }, start] },
          { $lt: [{ $toDate: "$created_at" }, nextStart] },
        ],
      },
    };
    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();
    const formattedTickets = tickets.map(formatTicket);
    logger.info(
      `🎫 Fetched ${formattedTickets.length} health (ALL) tickets for ${customerName} (${month}/${year}).`
    );
    return formattedTickets;
  } catch (error) {
    logger.error("Error in getHealthIncidentsAll:", error);
    throw new Error("Error fetching health (ALL) incidents: " + error.message);
  }
};

// Function to get Non-Health Incidents (ALL) - for Hino
const getNonHealthIncidentsAll = async (customerName, month, year) => {
  try {
    const { start, nextStart } = getMonthWindowUTC(year, month);
    const filters = {
      customer_name: customerName,
      incident_type: { $ne: "Health Incident" },
      $expr: {
        $and: [
          { $gte: [{ $toDate: "$created_at" }, start] },
          { $lt: [{ $toDate: "$created_at" }, nextStart] },
        ],
      },
    };
    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();
    const formattedTickets = tickets.map(formatTicket);
    logger.info(
      `🎫 Fetched ${formattedTickets.length} non-health (ALL) tickets for ${customerName} (${month}/${year}).`
    );
    return formattedTickets;
  } catch (error) {
    logger.error("Error in getNonHealthIncidentsAll:", error);
    throw new Error(
      "Error fetching non-health (ALL) incidents: " + error.message
    );
  }
};

// Function to filter health incidents from severity (ALL mode - UTC window)
const filterHealthIncidentsFromSeverityAll = async (
  customerKey,
  sortedMonths
) => {
  try {
    const filteredMonths = JSON.parse(JSON.stringify(sortedMonths));
    for (
      let monthIndex = 0;
      monthIndex < filteredMonths.length;
      monthIndex++
    ) {
      const month = filteredMonths[monthIndex];
      const monthId = month.id;
      const [year, monthNum] = monthId.split("-").map((part) => parseInt(part));
      const { start, nextStart } = getMonthWindowUTC(year, monthNum);

      const healthIncidents = await Incident.find({
        customer_name: customerKey,
        incident_type: "Health Incident",
        customer_escalation: { $regex: /^yes$/i },
        created_at: { $gte: start, $lt: nextStart },
      }).lean();
      const healthCounts = { high: 0, medium: 0, low: 0 };
      healthIncidents.forEach((incident) => {
        const priorityLower = (incident.priority || "")
          .toString()
          .trim()
          .toLowerCase();
        if (priorityLower.includes("high") || Number(incident.priority) === 3) {
          healthCounts.high++;
        } else if (
          priorityLower.includes("medium") ||
          priorityLower.includes("med") ||
          Number(incident.priority) === 2
        ) {
          healthCounts.medium++;
        } else if (priorityLower.includes("low") || Number(incident.priority) === 1) {
          healthCounts.low++;
        }
      });
      month.priorities.high = Math.max(0, month.priorities.high - healthCounts.high);
      month.priorities.medium = Math.max(0, month.priorities.medium - healthCounts.medium);
      month.priorities.low = Math.max(0, month.priorities.low - healthCounts.low);
    }
    return filteredMonths;
  } catch (error) {
    logger.error(
      `Error filtering health incidents from severity data (ALL mode): ${error.message}`
    );
    return sortedMonths;
  }
};

// Function to filter health incidents from handling status (ALL mode - UTC window)
const filterHealthIncidentsFromHandlingStatusAll = async (
  customerKey,
  sortedHsMonths
) => {
  try {
    const filteredHsMonths = JSON.parse(JSON.stringify(sortedHsMonths));
    for (
      let monthIndex = 0;
      monthIndex < filteredHsMonths.length;
      monthIndex++
    ) {
      const month = filteredHsMonths[monthIndex];
      const monthId = month.id;
      const [year, monthNum] = monthId.split("-").map((part) => parseInt(part));
      const { start, nextStart } = getMonthWindowUTC(year, monthNum);
      const healthIncidents = await Incident.find({
        customer_name: customerKey,
        incident_type: "Health Incident",
        customer_escalation: { $regex: /^yes$/i },
        created_at: { $gte: start, $lt: nextStart },
      }).lean();
      const healthCounts = { Pending: 0, Resolved: 0, Closed: 0 };
      healthIncidents.forEach((incident) => {
        const statusCode = incident.status;
        if (statusCode === 3) healthCounts.Pending++;
        else if (statusCode === 4) healthCounts.Resolved++;
        else if (statusCode === 5) healthCounts.Closed++;
      });
      month.statuses.Pending = Math.max(
        0,
        (month.statuses.Pending || 0) - healthCounts.Pending
      );
      month.statuses.Resolved = Math.max(
        0,
        (month.statuses.Resolved || 0) - healthCounts.Resolved
      );
      month.statuses.Closed = Math.max(0, (month.statuses.Closed || 0) - healthCounts.Closed);
    }
    return filteredHsMonths;
  } catch (error) {
    logger.error(`Error filtering health incidents from handling status data (ALL mode): ${error.message}`);
    return sortedHsMonths;
  }
};

// Function to filter health incidents from sub-status (ALL mode - UTC window)
const filterHealthIncidentsFromSubStatusAll = async (
  customerKey,
  subStatusData,
  month,
  year
) => {
  try {
    const filteredSubStatusData = JSON.parse(JSON.stringify(subStatusData));
    const { start, nextStart } = getMonthWindowUTC(year, month);

    const healthIncidents = await Incident.find({
      customer_name: customerKey,
      incident_type: "Health Incident",
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $gte: start, $lt: nextStart },
    }).lean();

    const healthCounts = {};
    healthIncidents.forEach((incident) => {
      const sub = incident.incident_sub_status || "Unknown";
      healthCounts[sub] = (healthCounts[sub] || 0) + 1;
    });

    filteredSubStatusData.forEach((item) => {
      const statusName = item._id;
      if (healthCounts[statusName]) {
        item.count = Math.max(0, item.count - healthCounts[statusName]);
      }
    });

    return filteredSubStatusData;
  } catch (error) {
    logger.error(`Error filtering health incidents from sub-status data (ALL mode): ${error.message}`);
    return subStatusData;
  }
};

// =============================================================================
// END NEW HELPERS
// =============================================================================

// Function to get Health Escalation Incidents
const getHealthEscalationIncidents = async (customerName, month, year) => {
  try {
    // Create regex for the specified month and year
    const dateRegex = new RegExp(`^${year}-${String(month).padStart(2, "0")}`);

    const filters = {
      customer_name: customerName,
      incident_type: "Health Incident",
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: dateRegex },
    };

    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();
    const formattedTickets = tickets.map(formatTicket);

    logger.info(
      `🎫 Fetched ${formattedTickets.length} health escalation tickets for ${customerName} (${month}/${year}).`
    );
    return formattedTickets;
  } catch (error) {
    logger.error("Error in getHealthEscalationIncidents:", error);
    throw new Error(
      "Error fetching health escalation incidents: " + error.message
    );
  }
};

const filterHealthIncidentsFromSubStatus = async (
  customerKey,
  subStatusData,
  month,
  year
) => {
  try {
    logger.info(
      `🔍 Filtering health incidents from sub-status for ${customerKey}, month: ${month}, year: ${year}`
    );
    logger.info(
      `🔍 Input sub-status data:`,
      JSON.stringify(subStatusData, null, 2)
    );

    // Create a deep copy to avoid modifying the original data
    const filteredSubStatusData = JSON.parse(JSON.stringify(subStatusData));

    // Create regex for the specified month and year
    const dateRegex = new RegExp(`^${year}-${String(month).padStart(2, "0")}`);

    // Count health incidents by sub-status for this month
    const healthIncidents = await Incident.find({
      customer_name: customerKey,
      incident_type: "Health Incident",
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: dateRegex },
    }).lean();

    logger.info(
      `🔍 Found ${healthIncidents.length} health incidents for filtering`
    );

    // Count by sub-status
    const healthCounts = {};
    healthIncidents.forEach((incident) => {
      const subStatus = incident.incident_sub_status || "Unknown";
      healthCounts[subStatus] = (healthCounts[subStatus] || 0) + 1;
    });

    logger.info(
      `🔍 Health incident counts by sub-status:`,
      JSON.stringify(healthCounts, null, 2)
    );

    // Subtract health incident counts from the total counts
    filteredSubStatusData.forEach((item) => {
      const statusName = item._id;
      if (healthCounts[statusName]) {
        const originalCount = item.count;
        item.count = Math.max(0, item.count - healthCounts[statusName]);
        logger.info(
          `🔍 Adjusted ${statusName}: ${originalCount} -> ${item.count} (subtracted ${healthCounts[statusName]})`
        );
      }
    });

    logger.info(
      `🔍 Filtered sub-status data:`,
      JSON.stringify(filteredSubStatusData, null, 2)
    );

    return filteredSubStatusData;
  } catch (error) {
    logger.error(
      `Error filtering health incidents from sub-status data: ${error.message}`
    );
    logger.error(error.stack);
    // If there's an error, return the original data
    return subStatusData;
  }
};

// Function to get Non-Health Escalation Incidents
const getNonHealthEscalationIncidents = async (customerName, month, year) => {
  try {
    // Create regex for the specified month and year
    const dateRegex = new RegExp(`^${year}-${String(month).padStart(2, "0")}`);

    const filters = {
      customer_name: customerName,
      incident_type: { $ne: "Health Incident" },
      customer_escalation: { $regex: /^yes$/i },
      created_at: { $regex: dateRegex },
    };

    const tickets = await Incident.find(filters).sort({ created_at: 1 }).lean();
    const formattedTickets = tickets.map(formatTicket);

    logger.info(
      `🎫 Fetched ${formattedTickets.length} non-health escalation tickets for ${customerName} (${month}/${year}).`
    );
    return formattedTickets;
  } catch (error) {
    logger.error("Error in getNonHealthEscalationIncidents:", error);
    throw new Error(
      "Error fetching non-health escalation incidents: " + error.message
    );
  }
};

const __dirname = path.resolve();

// Function to generate report PDF for a specific customer and month
async function generateMonthlyReportForCustomer(
  customerKey,
  customerDisplayName,
  month = null,
  year = null,
  isRetry = false
) {
  // Check if reports database connection is ready
  if (!isReportsDBConnected) {
    logger.error("❌ Reports database connection is not ready");
    throw new Error("Reports database connection is not ready");
  }

  // If month and year are provided, use them, otherwise use current month/year
  const reportDate =
    month && year ? new Date(`${month} 1, ${year}`) : new Date();
  const reportMonth = reportDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const formattedName = customerDisplayName.replace(/ /g, "_");
  const reportFileName = `${formattedName}_Monthly_Report_${reportDate.toLocaleString("default", { month: "short" })}_${reportDate.getFullYear()}.pdf`;
  const reportId = `${customerKey}_${reportDate.getMonth() + 1}_${reportDate.getFullYear()}`;

  // =======================================================================
  // START: FIX - Check for existing verified report before proceeding
  // =======================================================================
  if (!isRetry) {
    const ReportStatus = getReportStatusModel();
    const existingReport = await ReportStatus.findOne({ reportId });

    // Check if report exists and is verified
    if (existingReport && existingReport.status === "verified") {
      // Verify the blob actually exists in storage before skipping
      const blobExists = await verifyBlob(existingReport.blobPath, null);
      if (blobExists) {
        logger.info(
          `⏭️ Skipping already verified report for ${customerDisplayName} (${reportDate.getMonth() + 1}/${reportDate.getFullYear()})`
        );
        // Return the existing report details without regenerating
        return {
          blobUrl: existingReport.blobUrl,
          blobPath: existingReport.blobPath,
          reportId,
          checksum: existingReport.checksum,
          status: "verified",
        };
      } else {
        // Blob doesn't exist, update status to failed and continue with regeneration
        logger.warn(
          `⚠️ Report ${reportId} marked as verified but blob is missing. Regenerating...`
        );
        await updateReportStatus(reportId, {
          status: "failed",
          error: "Blob file is missing from storage",
        });
      }
    }
  }
  // =======================================================================
  // END: FIX
  // =======================================================================

  // Initialize or update report status (this will now only run if not skipped)
  if (!isRetry) {
    await updateReportStatus(reportId, {
      customerKey,
      customerDisplayName,
      month: reportDate.getMonth() + 1,
      year: reportDate.getFullYear(),
      status: "queued",
      queuedAt: new Date(),
    });
  }

  // Emit start event
  reportGenerationEvents.emit("reportStarted", {
    reportId,
    customerKey,
    customerDisplayName,
    month: reportDate.getMonth() + 1,
    year: reportDate.getFullYear(),
  });

  try {
    // Update status to generating
    await updateReportStatus(reportId, {
      status: "generating",
      generatingAt: new Date(),
    });

    logger.info(
      `📅 Starting monthly report generation for ${customerDisplayName} (${reportDate.getMonth() + 1}/${reportDate.getFullYear()})...`
    );

    // Format month for API calls
    const formattedMonth = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, "0")}`;

    // =======================================================================
    // START: LOGIC FOR "Hino Motor- HMST" TO SHOW ALL INCIDENTS
    // =======================================================================
    const useAllIncidents = customerKey === "Hino Motor- HMST";

    logger.info(
      `🔍 Fetching incident severity data for customer: ${customerKey} (useAllIncidents=${useAllIncidents})`
    );

    const incidentSeverityResponse = useAllIncidents
      ? await incidentService.getIncidentSeverity(customerKey, false, true)
      : await incidentService.getIncidentSeverityEscalation(customerKey, true);

    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${formattedMonth} (useAllIncidents=${useAllIncidents})`
    );
    const incidentDSResponse = useAllIncidents
      ? await incidentDSService.getIncidentsDetectionSource(
          formattedMonth,
          customerKey,
          false
        )
      : await incidentDSService.getIncidentsDetectionSourceEscalation(
          formattedMonth,
          customerKey
        );

    const prevMonth = new Date(
      reportDate.getFullYear(),
      reportDate.getMonth() - 1,
      1
    )
      .toISOString()
      .slice(0, 7);

    const twoMonthsAgo = new Date(
      reportDate.getFullYear(),
      reportDate.getMonth() - 2,
      1
    )
      .toISOString()
      .slice(0, 7);

    logger.info(
      `🔍 Fetching incident handling status data for customer: ${customerKey} (useAllIncidents=${useAllIncidents})`
    );
    const incidentHSResponse = useAllIncidents
      ? await incidentHSService.getIncidentsHandlingStatus(
          customerKey,
          false,
          true
        )
      : await incidentHSService.getIncidentsHandlingStatusEscalation(
          customerKey,
          true
        );

    logger.info(
      `🔍 Fetching incident sub-status data for customer: ${customerKey}, month: ${formattedMonth} (useAllIncidents=${useAllIncidents})`
    );
    const incidentSSResponse = useAllIncidents
      ? await incidentSSService.getIncidentsSubStatusForReport(
          formattedMonth,
          customerKey,
          false
        )
      : await incidentSSService.getIncidentsSubStatusEscalationForReport(
          formattedMonth,
          customerKey
        );
    // =======================================================================
    // END: LOGIC FOR "Hino Motor- HMST"
    // =======================================================================

    logger.info(
      `🔍 Raw sub-status response for ${customerKey}:`,
      JSON.stringify(incidentSSResponse, null, 2)
    );

    // Validate responses
    if (!incidentSeverityResponse || !incidentSeverityResponse.months) {
      throw new Error("Invalid incident severity response");
    }

    if (!incidentDSResponse || !incidentDSResponse.detectionsource) {
      throw new Error("Invalid incident detection source response");
    }

    if (!incidentHSResponse || !incidentHSResponse.months) {
      throw new Error("Invalid incident handling status response");
    }

    if (!incidentSSResponse || !incidentSSResponse.substatus) {
      throw new Error("Invalid incident sub-status response");
    }

    // Format the severity data for the chart
    const months = incidentSeverityResponse.months;
    const sortedMonths = [...months].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    // Filter out health incidents from severity data
    // Original logic (Escalation/Regex)
    const filterHealthIncidentsFromSeverity = async (
      customerKey,
      sortedMonths
    ) => {
      try {
        const filteredMonths = JSON.parse(JSON.stringify(sortedMonths));
        for (
          let monthIndex = 0;
          monthIndex < filteredMonths.length;
          monthIndex++
        ) {
          const month = filteredMonths[monthIndex];
          const monthId = month.id;
          const [year, monthNum] = monthId
            .split("-")
            .map((part) => parseInt(part));
          const dateRegex = new RegExp(
            `^${year}-${String(monthNum).padStart(2, "0")}`
          );
          const healthIncidents = await Incident.find({
            customer_name: customerKey,
            incident_type: "Health Incident",
            customer_escalation: { $regex: /^yes$/i },
            created_at: { $regex: dateRegex },
          }).lean();
          const healthCounts = { high: 0, medium: 0, low: 0 };
          healthIncidents.forEach((incident) => {
            const priorityLower = (incident.priority || "")
              .toString()
              .trim()
              .toLowerCase();
            if (
              priorityLower.includes("high") ||
              Number(incident.priority) === 3
            ) {
              healthCounts.high++;
            } else if (
              priorityLower.includes("medium") ||
              priorityLower.includes("med") ||
              Number(incident.priority) === 2
            ) {
              healthCounts.medium++;
            } else if (
              priorityLower.includes("low") ||
              Number(incident.priority) === 1
            ) {
              healthCounts.low++;
            }
          });
          month.priorities.high = Math.max(
            0,
            month.priorities.high - healthCounts.high
          );
          month.priorities.medium = Math.max(
            0,
            month.priorities.medium - healthCounts.medium
          );
          month.priorities.low = Math.max(
            0,
            month.priorities.low - healthCounts.low
          );
        }
        return filteredMonths;
      } catch (error) {
        logger.error(
          `Error filtering health incidents from severity data: ${error.message}`
        );
        return sortedMonths;
      }
    };

    logger.info(
      `🔍 Filtering health incidents from severity data for ${customerKey}...`
    );
    
    // CHOOSE FILTER FUNCTION BASED ON CUSTOMER
    const filteredSortedMonths = await (useAllIncidents
      ? filterHealthIncidentsFromSeverityAll(customerKey, sortedMonths)
      : filterHealthIncidentsFromSeverity(customerKey, sortedMonths));

    logger.info(
      `✅ Filtered health incidents from severity data for ${customerKey}`
    );

    const severityChartLabels = filteredSortedMonths.map((month) => month.name);
    const severityChartData = {
      high: filteredSortedMonths.map((month) => month.priorities.high || 0),
      medium: filteredSortedMonths.map((month) => month.priorities.medium || 0),
      low: filteredSortedMonths.map((month) => month.priorities.low || 0),
    };
    const incidentSeverityData = [
      {
        affiliate: customerDisplayName,
        high:
          filteredSortedMonths.find((m) => m.period === "Current Month")
            ?.priorities.high || 0,
        medium:
          filteredSortedMonths.find((m) => m.period === "Current Month")
            ?.priorities.medium || 0,
        low:
          filteredSortedMonths.find((m) => m.period === "Current Month")
            ?.priorities.low || 0,
      },
    ];

    // Process detection source data for the chart and table
    const currentMonthSources = incidentDSResponse.detectionsource || {};
    const filteredSources = {};
    Object.keys(currentMonthSources).forEach((sourceName) => {
      if (sourceName !== "Health Incident") {
        filteredSources[sourceName] = currentMonthSources[sourceName];
      }
    });

    const detectionChartLabels = Object.keys(filteredSources);
    const detectionChartData = {
      high: detectionChartLabels.map(
        (sourceName) => filteredSources[sourceName]?.High || 0
      ),
      medium: detectionChartLabels.map(
        (sourceName) => filteredSources[sourceName]?.Medium || 0
      ),
      low: detectionChartLabels.map(
        (sourceName) => filteredSources[sourceName]?.Low || 0
      ),
    };

    const incidentDetectionData = [
      {
        affiliate: customerDisplayName,
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = filteredSources[sourceName] || {};
          acc[sourceName] = source.Total || 0;
          return acc;
        }, {}),
      },
    ];

    // Process handling status data for the chart
    const hsMonths = incidentHSResponse.months;
    const sortedHsMonths = [...hsMonths].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    // Original Logic (Escalation)
    const filterHealthIncidentsFromHandlingStatus = async (
      customerKey,
      sortedHsMonths
    ) => {
      try {
        const filteredHsMonths = JSON.parse(JSON.stringify(sortedHsMonths));
        for (
          let monthIndex = 0;
          monthIndex < filteredHsMonths.length;
          monthIndex++
        ) {
          const month = filteredHsMonths[monthIndex];
          const monthId = month.id;
          const [year, monthNum] = monthId
            .split("-")
            .map((part) => parseInt(part));
          const dateRegex = new RegExp(
            `^${year}-${String(monthNum).padStart(2, "0")}`
          );
          const healthIncidents = await Incident.find({
            customer_name: customerKey,
            incident_type: "Health Incident",
            customer_escalation: { $regex: /^yes$/i },
            created_at: { $regex: dateRegex },
          }).lean();
          const healthCounts = { Pending: 0, Resolved: 0, Closed: 0 };
          healthIncidents.forEach((incident) => {
            const statusCode = incident.status;
            if (statusCode === 3) healthCounts.Pending++;
            else if (statusCode === 4) healthCounts.Resolved++;
            else if (statusCode === 5) healthCounts.Closed++;
          });
          month.statuses.Pending = Math.max(
            0,
            (month.statuses.Pending || 0) - healthCounts.Pending
          );
          month.statuses.Resolved = Math.max(
            0,
            (month.statuses.Resolved || 0) - healthCounts.Resolved
          );
          month.statuses.Closed = Math.max(
            0,
            (month.statuses.Closed || 0) - healthCounts.Closed
          );
        }
        return filteredHsMonths;
      } catch (error) {
        logger.error(
          `Error filtering health incidents from handling status data: ${error.message}`
        );
        return sortedHsMonths;
      }
    };

    logger.info(
      `🔍 Filtering health incidents from handling status data for ${customerKey}...`
    );

    // CHOOSE FILTER FUNCTION BASED ON CUSTOMER
    const filteredHsMonths = await (useAllIncidents
      ? filterHealthIncidentsFromHandlingStatusAll(customerKey, sortedHsMonths)
      : filterHealthIncidentsFromHandlingStatus(customerKey, sortedHsMonths));

    logger.info(
      `✅ Filtered health incidents from handling status data for ${customerKey}`
    );

    const handlingStatusChartLabels = filteredHsMonths.map(
      (month) => month.name
    );

    // If useAllIncidents, include Escalated in Pending (as per Code 2)
    const handlingStatusChartData = {
      pending: filteredHsMonths.map(
        (month) => (month.statuses.Pending || 0) + (useAllIncidents ? (month.statuses.Escalated || 0) : 0)
      ),
      resolved: filteredHsMonths.map(
        (month) => (month.statuses.Resolved || 0) + (month.statuses.Closed || 0)
      ),
    };

    const incidentHandlingStatusData = [
      {
        affiliate: "Current Month",
        pending:
          (filteredHsMonths.find((m) => m.period === "Current Month")?.statuses.Pending || 0) + 
          (useAllIncidents ? (filteredHsMonths.find((m) => m.period === "Current Month")?.statuses.Escalated || 0) : 0),
        resolved:
          (filteredHsMonths.find((m) => m.period === "Current Month")?.statuses.Resolved || 0) +
          (filteredHsMonths.find((m) => m.period === "Current Month")?.statuses.Closed || 0),
      },
      {
        affiliate: "Previous Month",
        pending:
          (filteredHsMonths.find((m) => m.period === "Previous Month")?.statuses.Pending || 0) + 
          (useAllIncidents ? (filteredHsMonths.find((m) => m.period === "Previous Month")?.statuses.Escalated || 0) : 0),
        resolved:
          (filteredHsMonths.find((m) => m.period === "Previous Month")?.statuses.Resolved || 0) +
          (filteredHsMonths.find((m) => m.period === "Previous Month")?.statuses.Closed || 0),
      },
      {
        affiliate: "Two Months Ago",
        pending:
          (filteredHsMonths.find((m) => m.period === "Two Months Ago")?.statuses.Pending || 0) + 
          (useAllIncidents ? (filteredHsMonths.find((m) => m.period === "Two Months Ago")?.statuses.Escalated || 0) : 0),
        resolved:
          (filteredHsMonths.find((m) => m.period === "Two Months Ago")?.statuses.Resolved || 0) +
          (filteredHsMonths.find((m) => m.period === "Two Months Ago")?.statuses.Closed || 0),
      },
    ];

    // Process sub-status data for the chart
    const subStatusData = incidentSSResponse.substatus || [];
    const filteredSubstatus = subStatusData.filter((item) => item._id !== null);

    logger.info(
      `🔍 Filtering health incidents from sub-status data for ${customerKey}...`
    );
    
    // CHOOSE FILTER FUNCTION BASED ON CUSTOMER
    const filteredSubStatusData = await (useAllIncidents
      ? filterHealthIncidentsFromSubStatusAll(
          customerKey,
          filteredSubstatus,
          reportDate.getMonth() + 1,
          reportDate.getFullYear()
        )
      : filterHealthIncidentsFromSubStatus(
          customerKey,
          filteredSubstatus,
          reportDate.getMonth() + 1,
          reportDate.getFullYear()
        ));
    
    logger.info(
      `✅ Filtered health incidents from sub-status data for ${customerKey}`
    );

    let subStatusChartLabels, subStatusChartData, subStatusColors;

    if (filteredSubStatusData.length === 0) {
      logger.warn("Warning: Sub-status array is empty after filtering");
      subStatusChartLabels = ["No data available"];
      subStatusChartData = [0];
      subStatusColors = ["#556ee6"];
    } else {
      const colorMap = {
        "SOC Investigating": "#70b5fa",
        "Awaiting Customer Response": "#f2a150",
        "False Positive": "#00cc00",
        "True Positive": "#ff0000",
      };

      const formattedData = filteredSubStatusData.map((item) => {
        const status = item._id;
        const color = colorMap[status] || "#556ee6";
        return {
          status,
          count: item.count,
          color,
        };
      });

      const desiredOrder = [
        "SOC Investigating",
        "Awaiting Customer Response",
        "False Positive",
        "True Positive",
      ];

      formattedData.sort((a, b) => {
        const aIndex = desiredOrder.indexOf(a.status);
        const bIndex = desiredOrder.indexOf(b.status);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        return a.status.localeCompare(b.status);
      });

      subStatusChartLabels = formattedData.map((item) => item.status);
      subStatusChartData = formattedData.map((item) => item.count);
      subStatusColors = formattedData.map((item) => item.color);

      const countsByStatus = {};
      formattedData.forEach((item) => {
        countsByStatus[item.status] = item.count;
      });

      logger.info(`📊 Sub-status counts: ${JSON.stringify(countsByStatus)}`);
    }
    const incidentSubStatusData = [
      {
        affiliate: "Current Month",
        ...subStatusChartLabels.reduce((acc, statusName, index) => {
          acc[statusName] = subStatusChartData[index] || 0;
          return acc;
        }, {}),
      },
    ];

    // Fetch real ticket data
    logger.info(
      "🎫 Fetching real data for incident and health ticket tables..."
    );

    // CHOOSE TICKET FETCH FUNCTION BASED ON CUSTOMER
    const incidentTicketsData = useAllIncidents
      ? await getNonHealthIncidentsAll(
          customerKey,
          reportDate.getMonth() + 1,
          reportDate.getFullYear()
        )
      : await getNonHealthEscalationIncidents(
          customerKey,
          reportDate.getMonth() + 1,
          reportDate.getFullYear()
        );

    const healthTicketsData = useAllIncidents
      ? await getHealthIncidentsAll(
          customerKey,
          reportDate.getMonth() + 1,
          reportDate.getFullYear()
        )
      : await getHealthEscalationIncidents(
          customerKey,
          reportDate.getMonth() + 1,
          reportDate.getFullYear()
        );

    logger.info(
      `✅ Fetched ${incidentTicketsData.length} incident tickets and ${healthTicketsData.length} health tickets.`
    );

    // Define the legend data for substatus chart
    const subStatusLegend = [
      { label: "SOC Investigating", color: "#70b5fa" },
      { label: "Awaiting Customer Response", color: "#f2a150" },
      { label: "False Positive", color: "#00cc00" },
      { label: "True Positive", color: "#ff0000" },
    ];

    // Prepare data for the report
    const data = {
      reportMonth,
      customerDisplayName,
      incidentSeverityData,
      detectionSources: detectionChartLabels,
      incidentDetectionData,
      severityChartLabels,
      severityChartData,
      detectionChartLabels,
      detectionChartData,
      handlingStatusChartLabels,
      handlingStatusChartData,
      incidentHandlingStatusData,
      subStatusChartLabels,
      subStatusChartData,
      subStatusColors,
      subStatusLegend,
      incidentSubStatusData,
      incidentTickets: incidentTicketsData,
      healthTickets: healthTicketsData,
    };

    logger.info(`🧠 Generating ticket summaries for ${customerDisplayName}...`);
    data.incidentTicketSummary = await generateTicketSummary(
      incidentTicketsData,
      "Incident",
      reportMonth
    );
    data.healthTicketSummary = await generateTicketSummary(
      healthTicketsData,
      "Health",
      reportMonth
    );
    logger.info(`✅ Ticket summaries generated for ${customerDisplayName}`);
    logger.info(`✅ Incident Ticket Summary: ${data.incidentTicketSummary}`);
    logger.info(`✅ Health Ticket Summary ${data.healthTicketSummary}`);

    logger.info(
      `🧠 Generating executive summary with Azure OpenAI for ${customerDisplayName}...`
    );
    const executiveSummary = await generateExecutiveSummary(
      data,
      customerDisplayName
    );
    data.executiveSummary = executiveSummary;

    logger.info(`✅ Executive summary generated for ${customerDisplayName}`);

    // Render HTML from EJS
    const templatePath = path.join(
      process.cwd(),
      "src",
      "templates",
      "reportTemplate.ejs"
    );
    const html = await ejs.renderFile(templatePath, data);

    // Create a temporary directory for the PDF generation
    const tempDir = path.join(process.cwd(), "src", "temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF in temporary directory
    const tempPdfPath = path.join(tempDir, reportFileName);
    await page.pdf({
      path: tempPdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "15px", right: "15px" },
    });

    await browser.close();

    // Update status to generated
    await updateReportStatus(reportId, {
      status: "generated",
      generatedAt: new Date(),
      fileSize: fs.statSync(tempPdfPath).size,
    });

    // Calculate checksum
    const checksum = calculateChecksum(tempPdfPath);

    // Update status with checksum
    await updateReportStatus(reportId, {
      checksum,
    });

    // Create blob path that mimics the directory structure
    const blobPath = `${customerKey}/${reportDate.getFullYear()}/${reportDate.toLocaleString("default", { month: "short" }).toLowerCase()}/${reportFileName}`;

    // Update status to uploading
    await updateReportStatus(reportId, {
      status: "uploading",
      uploadingAt: new Date(),
    });

    // Upload to Azure Blob Storage
    const { blobUrl } = await uploadToBlobStorage(
      tempPdfPath,
      blobPath,
      checksum
    );

    // Update status to uploaded
    await updateReportStatus(reportId, {
      status: "uploaded",
      blobUrl,
      blobPath,
      uploadedAt: new Date(),
    });

    // Verify the uploaded blob
    const isVerified = await verifyBlob(blobPath, checksum);

    if (isVerified) {
      // Update status to verified
      await updateReportStatus(reportId, {
        status: "verified",
        verifiedAt: new Date(),
      });
    } else {
      // Update status to failed instead of throwing an error
      await updateReportStatus(reportId, {
        status: "failed",
        error: `Failed to verify uploaded blob: ${blobPath}`,
      });

      // Emit failure event
      reportGenerationEvents.emit("reportFailed", {
        reportId,
        customerKey,
        customerDisplayName,
        month: reportDate.getMonth() + 1,
        year: reportDate.getFullYear(),
        error: `Failed to verify uploaded blob: ${blobPath}`,
        retryCount,
        maxRetries,
      });

      // Return early without throwing an error to avoid crashing the process
      return {
        blobUrl,
        blobPath,
        reportId,
        checksum,
        status: "failed",
        error: `Failed to verify uploaded blob: ${blobPath}`,
      };
    }

    // Emit completion event
    reportGenerationEvents.emit("reportCompleted", {
      reportId,
      customerKey,
      customerDisplayName,
      month: reportDate.getMonth() + 1,
      year: reportDate.getFullYear(),
      blobUrl,
      checksum,
    });

    logger.info(
      `✅ Monthly report generated and uploaded for ${customerDisplayName} (${reportDate.getMonth() + 1}/${reportDate.getFullYear()}): ${blobUrl}`
    );

    return { blobUrl, blobPath, reportId, checksum };
  } catch (error) {
    logger.error(
      `❌ Error generating report for ${customerDisplayName} (${reportDate.getMonth() + 1}/${reportDate.getFullYear()})`,
      error
    );

    // Get current report status to check retry count
    const ReportStatus = getReportStatusModel();
    const currentStatus = await ReportStatus.findOne({ reportId });
    const retryCount = currentStatus ? currentStatus.retryCount : 0;
    const maxRetries = currentStatus ? currentStatus.maxRetries : 3;

    // Update status to failed
    await updateReportStatus(reportId, {
      status: "failed",
      error: error.message,
    });

    // Emit failure event
    reportGenerationEvents.emit("reportFailed", {
      reportId,
      customerKey,
      customerDisplayName,
      month: reportDate.getMonth() + 1,
      year: reportDate.getFullYear(),
      error: error.message,
      retryCount,
      maxRetries,
    });

    // If we haven't reached max retries, schedule a retry
    if (retryCount < maxRetries) {
      logger.info(
        `🔄 Scheduling retry ${retryCount + 1}/${maxRetries} for ${customerDisplayName} report`
      );

      // Update status to retrying
      await updateReportStatus(reportId, {
        status: "retrying",
        retryCount: retryCount + 1,
      });

      // Schedule retry with exponential backoff (5 minutes, 15 minutes, 45 minutes)
      const delayMs = Math.pow(3, retryCount) * 5 * 60 * 1000;

      setTimeout(async () => {
        try {
          await generateMonthlyReportForCustomer(
            customerKey,
            customerDisplayName,
            reportDate.getMonth() + 1,
            reportDate.getFullYear(),
            true // This is a retry
          );
        } catch (retryError) {
          logger.error(
            `❌ Retry failed for ${customerDisplayName} report:`,
            retryError
          );
        }
      }, delayMs);
    }

    throw error;
  }
}

// Function to generate reports for all months from January 2025 for all customers
async function generateAllHistoricalReports() {
  logger.info("📅 Starting historical report generation for all customers...");
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    reports: [],
    errors: [],
  };

  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Generate report for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(
      customers
    )) {
      try {
        // Generate reports from January 2025 to current month
        for (let year = 2025; year <= currentYear; year++) {
          const startMonth = year === 2025 ? 1 : 1;
          const endMonth = year === currentYear ? currentMonth : 12;

          for (let month = startMonth; month <= endMonth; month++) {
            const reportId = `${customerKey}_${month}_${year}`;
            results.total++;

            // Get the ReportStatus model
            const ReportStatus = getReportStatusModel();
            const existingReport = await ReportStatus.findOne({ reportId });

            // Check if report exists and is verified AND the blob actually exists
            if (existingReport && existingReport.status === "verified") {
              // Verify the blob actually exists before skipping
              const blobExists = await verifyBlob(
                existingReport.blobPath,
                null
              );
              if (blobExists) {
                results.successful++;
                results.reports.push({
                  reportId,
                  customerKey,
                  customerDisplayName,
                  month,
                  year,
                  blobUrl: existingReport.blobUrl,
                  status: "verified",
                  timestamp: existingReport.verifiedAt,
                });

                logger.info(
                  `⏭️ Skipping already verified report for ${customerDisplayName} (${month}/${year})`
                );
                continue;
              } else {
                // Blob doesn't exist, update status to failed and continue with generation
                logger.warn(
                  `⚠️ Report ${reportId} marked as verified but blob is missing. Regenerating...`
                );
                await updateReportStatus(reportId, {
                  status: "failed",
                  error: "Blob file is missing from storage",
                });
              }
            }

            // If report exists but failed, and we haven't reached max retries, skip
            if (
              existingReport &&
              existingReport.status === "failed" &&
              existingReport.retryCount >= existingReport.maxRetries
            ) {
              results.failed++;
              results.errors.push({
                reportId,
                customerKey,
                customerDisplayName,
                month,
                year,
                error: existingReport.error,
                status: "failed",
                timestamp: existingReport.updatedAt,
              });

              logger.info(
                `⏭️ Skipping failed report for ${customerDisplayName} (${month}/${year}) - max retries reached`
              );
              continue;
            }

            // If report is pending or processing, count it and continue
            if (
              existingReport &&
              (existingReport.status === "queued" ||
                existingReport.status === "generating" ||
                existingReport.status === "generated" ||
                existingReport.status === "uploading" ||
                existingReport.status === "uploaded" ||
                existingReport.status === "retrying")
            ) {
              if (existingReport.status === "queued") results.pending++;
              else if (
                existingReport.status === "generating" ||
                existingReport.status === "generated" ||
                existingReport.status === "uploading" ||
                existingReport.status === "uploaded" ||
                existingReport.status === "retrying"
              )
                results.processing++;

              results.reports.push({
                reportId,
                customerKey,
                customerDisplayName,
                month,
                year,
                status: existingReport.status,
                timestamp: existingReport.updatedAt,
              });

              logger.info(
                `⏭️ Skipping ${existingReport.status} report for ${customerDisplayName} (${month}/${year})`
              );
              continue;
            }

            try {
              // Generate the report
              const reportResult = await generateMonthlyReportForCustomer(
                customerKey,
                customerDisplayName,
                month,
                year
              );

              // Only count as successful if status is verified
              if (reportResult.status === "verified") {
                results.successful++;
              } else {
                results.failed++;
              }

              results.reports.push({
                reportId,
                customerKey,
                customerDisplayName,
                month,
                year,
                blobUrl: reportResult.blobUrl,
                status: reportResult.status || "verified",
                timestamp: new Date().toISOString(),
              });

              logger.info(
                `✅ Generated report for ${customerDisplayName} (${month}/${year}) with status: ${reportResult.status || "verified"}`
              );
            } catch (error) {
              results.failed++;
              results.errors.push({
                reportId,
                customerKey,
                customerDisplayName,
                month,
                year,
                error: error.message,
                status: "failed",
                timestamp: new Date().toISOString(),
              });

              logger.error(
                `❌ Failed to generate report for ${customerDisplayName} (${month}/${year}):`,
                error
              );
            }
          }
        }
      } catch (error) {
        logger.error(
          `❌ Failed to process reports for ${customerDisplayName}:`,
          error
        );
      }
    }

    logger.info(
      `📊 Report generation summary: ${results.successful}/${results.total} successful, ${results.failed} failed, ${results.pending} pending, ${results.processing} processing`
    );

    return results;
  } catch (error) {
    logger.error(
      "❌ Error generating historical reports for all customers:",
      error
    );
    throw error;
  }
}

// Function to generate report PDF for all customers for the previous month
async function generateMonthlyReport() {
  logger.info(
    "📅 Starting monthly report generation for all customers (previous month)..."
  );
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    reports: [],
    errors: [],
  };

  try {
    // Get the previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = prevMonth.getMonth() + 1;
    const year = prevMonth.getFullYear();

    // Generate report for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(
      customers
    )) {
      const reportId = `${customerKey}_${month}_${year}`;
      results.total++;

      // Get the ReportStatus model
      const ReportStatus = getReportStatusModel();
      const existingReport = await ReportStatus.findOne({ reportId });

      // Check if report exists and is verified AND blob actually exists
      if (existingReport && existingReport.status === "verified") {
        // Verify blob actually exists before skipping
        const blobExists = await verifyBlob(existingReport.blobPath, null);
        if (blobExists) {
          results.successful++;
          results.reports.push({
            reportId,
            customerKey,
            customerDisplayName,
            month,
            year,
            blobUrl: existingReport.blobUrl,
            status: "verified",
            timestamp: existingReport.verifiedAt,
          });

          logger.info(
            `⏭️ Skipping already verified report for ${customerDisplayName} (${month}/${year})`
          );
          continue;
        } else {
          // Blob doesn't exist, update status to failed and continue with generation
          logger.warn(
            `⚠️ Report ${reportId} marked as verified but blob is missing. Regenerating...`
          );
          await updateReportStatus(reportId, {
            status: "failed",
            error: "Blob file is missing from storage",
          });
        }
      }

      try {
        const reportResult = await generateMonthlyReportForCustomer(
          customerKey,
          customerDisplayName,
          month,
          year
        );

        // Check the final status from the result to determine success
        const finalStatus = reportResult.status || "verified";
        if (finalStatus === "verified") {
          results.successful++;
        } else {
          results.failed++;
        }

        results.reports.push({
          reportId,
          customerKey,
          customerDisplayName,
          month,
          year,
          blobUrl: reportResult.blobUrl,
          status: finalStatus,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          reportId,
          customerKey,
          customerDisplayName,
          month,
          year,
          error: error.message,
          status: "failed",
          timestamp: new Date().toISOString(),
        });

        logger.error(
          `❌ Failed to generate report for ${customerDisplayName}:`,
          error
        );
      }
    }

    logger.info(
      `✅ Generated ${results.successful}/${results.total} reports for all customers for ${month}/${year}`
    );
    return results;
  } catch (error) {
    logger.error("❌ Error generating reports for all customers:", error);
    throw error;
  }
}
// Function to get report data for a specific customer
async function getReportDataForCustomer(customerKey, customerDisplayName) {
  try {
    const now = new Date();
    const reportMonth = now.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Fetch real incident severity data
    logger.info(
      `🔍 Fetching incident severity data for customer: ${customerKey}`
    );
    const incidentSeverityResponse =
      await incidentService.getIncidentSeverityEscalation(customerKey, true);

    // Fetch real incident detection source data for current month
    const currentMonth = now.toISOString().slice(0, 7);
    logger.info(
      `🔍 Fetching incident detection source data for customer: ${customerKey}, month: ${currentMonth}`
    );
    const incidentDSResponse =
      await incidentDSService.getIncidentsDetectionSourceEscalation(
        currentMonth,
        customerKey
      );

    // Fetch previous month data
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);

    // Fetch two months ago data
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 7);

    // Fetch incident handling status data
    logger.info(
      `🔍 Fetching incident handling status data for customer: ${customerKey}`
    );
    const incidentHSResponse =
      await incidentHSService.getIncidentsHandlingStatusEscalation(
        customerKey,
        true
      );

    // Fetch incident sub-status data for current month
    logger.info(
      `🔍 Fetching incident sub-status data for customer: ${customerKey}, month: ${currentMonth}`
    );
    const incidentSSResponse =
      await incidentSSService.getIncidentsSubStatusEscalation(
        currentMonth,
        customerKey
      );

    logger.info(
      `🔍 Raw sub-status response for ${customerKey}:`,
      JSON.stringify(incidentSSResponse, null, 2)
    );

    // Validate responses
    const months =
      incidentSeverityResponse?.data?.months ||
      incidentSeverityResponse?.months ||
      incidentSeverityResponse;
    if (!months || months.length === 0) {
      throw new Error("Invalid incident severity response");
    }

    if (!incidentDSResponse || !incidentDSResponse.detectionsource) {
      throw new Error("Invalid incident detection source response");
    }

    if (!incidentHSResponse || !incidentHSResponse.months) {
      throw new Error("Invalid incident handling status response");
    }

    if (!incidentSSResponse || !incidentSSResponse.substatus) {
      throw new Error("Invalid incident sub-status response");
    }

    // Sort months by their period
    const sortedMonths = [...months].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    const severityChartLabels = sortedMonths.map((month) => month.name);
    const severityChartData = {
      high: sortedMonths.map((month) => month.priorities.high || 0),
      medium: sortedMonths.map((month) => month.priorities.medium || 0),
      low: sortedMonths.map((month) => month.priorities.low || 0),
    };

    // Create affiliate data for the severity table
    const incidentSeverityData = [
      {
        affiliate: customerDisplayName,
        high:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Current Month")?.priorities
            .low || 0,
      },
      {
        affiliate: "Previous Month",
        high:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Previous Month")?.priorities
            .low || 0,
      },
      {
        affiliate: "Two Months Ago",
        high:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .high || 0,
        medium:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .medium || 0,
        low:
          sortedMonths.find((m) => m.period === "Two Months Ago")?.priorities
            .low || 0,
      },
    ];

    // Process detection source data for the chart and table
    const currentMonthSources = incidentDSResponse.detectionsource || [];
    const prevMonthSources = prevMonthDSResponse?.detectionsource || [];
    const twoMonthsAgoSources = twoMonthsAgoDSResponse?.detectionsource || [];

    // Get all unique source names across all months
    const allSourceNames = new Set();
    [
      ...currentMonthSources,
      ...prevMonthSources,
      ...twoMonthsAgoSources,
    ].forEach((source) => {
      const sourceName = source._id || "EntraID";
      allSourceNames.add(sourceName);
    });

    const detectionChartLabels = Array.from(allSourceNames);

    // Create data for the chart (current month only)
    const detectionChartData = detectionChartLabels.map((sourceName) => {
      const source = currentMonthSources.find((s) => {
        const sName = s._id || "EntraID";
        return sName === sourceName;
      });
      return source ? source.count : 0;
    });

    // Create affiliate data for the detection source table
    const incidentDetectionData = [
      {
        affiliate: customerDisplayName,
        ...detectionChartLabels.reduce((acc, sourceName) => {
          const source = currentMonthSources.find((s) => {
            const sName = s._id || "EntraID";
            return sName === sourceName;
          });
          acc[sourceName] = source ? source.count : 0;
          return acc;
        }, {}),
      },
    ];

    // Process handling status data for the chart
    const hsMonths = incidentHSResponse.months;
    const sortedHsMonths = [...hsMonths].sort((a, b) => {
      const periodOrder = {
        "Two Months Ago": 0,
        "Previous Month": 1,
        "Current Month": 2,
      };
      return periodOrder[a.period] - periodOrder[b.period];
    });

    const handlingStatusChartLabels = sortedHsMonths.map((month) => month.name);
    const handlingStatusChartData = {
      pending: sortedHsMonths.map((month) => month.statuses.Pending || 0),

      resolved: sortedHsMonths.map(
        (month) => (month.statuses.Resolved || 0) + (month.statuses.Closed || 0)
      ),
    };

    // Create affiliate data for the handling status table
    const incidentHandlingStatusData = [
      {
        affiliate: "Current Month",

        pending:
          sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Pending || 0,
        resolved:
          (sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Resolved || 0) +
          (sortedHsMonths.find((m) => m.period === "Current Month")?.statuses
            .Closed || 0),
      },
      {
        affiliate: "Previous Month",
        pending:
          sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Pending || 0,
        resolved:
          (sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Resolved || 0) +
          (sortedHsMonths.find((m) => m.period === "Previous Month")?.statuses
            .Closed || 0),
      },
      {
        affiliate: "Two Months Ago",
        pending:
          sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Pending || 0,
        resolved:
          (sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Resolved || 0) +
          (sortedHsMonths.find((m) => m.period === "Two Months Ago")?.statuses
            .Closed || 0),
      },
    ];

    // Process sub-status data for the chart
    // In getReportDataForCustomer function, make sure you're using the filtered data:
    // Process sub-status data for the chart
    const subStatusData = incidentSSResponse.substatus || [];
    const filteredSubstatus = subStatusData.filter((item) => item._id !== null);

    // Apply the health incident filter to the sub-status data
    logger.info(
      `🔍 Filtering health incidents from sub-status data for ${customerKey}...`
    );
    const filteredSubStatusData = await filterHealthIncidentsFromSubStatus(
      customerKey,
      filteredSubstatus,
      now.getMonth() + 1,
      now.getFullYear()
    );
    logger.info(
      `✅ Filtered health incidents from sub-status data for ${customerKey}`
    );

    let subStatusChartLabels, subStatusChartData, subStatusColors;

    if (filteredSubStatusData.length === 0) {
      logger.warn("Warning: Sub-status array is empty after filtering");
      subStatusChartLabels = ["No data available"];
      subStatusChartData = [0];
      subStatusColors = ["#556ee6"];
    } else {
      const colorMap = {
        "SOC Investigating": "#70b5fa",
        "Awaiting Customer Response": "#f2a150",
        "False Positive": "#00cc00",
        "True Positive": "#ff0000",
      };

      const formattedData = filteredSubStatusData.map((item) => {
        const status = item._id;
        const color = colorMap[status] || "#556ee6";
        return {
          status,
          count: item.count,
          color,
        };
      });

      const desiredOrder = [
        "SOC Investigating",
        "Awaiting Customer Response",
        "False Positive",
        "True Positive",
      ];

      formattedData.sort((a, b) => {
        const aIndex = desiredOrder.indexOf(a.status);
        const bIndex = desiredOrder.indexOf(b.status);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        return a.status.localeCompare(b.status);
      });

      subStatusChartLabels = formattedData.map((item) => item.status);
      subStatusChartData = formattedData.map((item) => item.count);
      subStatusColors = formattedData.map((item) => item.color);

      const countsByStatus = {};
      formattedData.forEach((item) => {
        countsByStatus[item.status] = item.count;
      });

      logger.info(`📊 Sub-status counts: ${JSON.stringify(countsByStatus)}`);
    }

    // Create affiliate data for the sub-status table
    const incidentSubStatusData = [
      {
        affiliate: "Current Month",
        ...subStatusChartLabels.reduce((acc, statusName, index) => {
          acc[statusName] = subStatusChartData[index] || 0;
          return acc;
        }, {}),
      },
    ];

    // Fetch real ticket data
    logger.info(
      "🎫 Fetching real data for incident and health ticket tables..."
    );

    const incidentTicketsData = await getNonHealthEscalationIncidents(
      customerKey,
      reportDate.getMonth() + 1,
      reportDate.getFullYear()
    );

    const healthTicketsData = await getHealthEscalationIncidents(
      customerKey,
      reportDate.getMonth() + 1,
      reportDate.getFullYear()
    );

    logger.info(
      `✅ Fetched ${incidentTicketsData.length} incident tickets and ${healthTicketsData.length} health tickets.`
    );

    // Define the legend data for substatus chart
    const subStatusLegend = [
      { label: "SOC Investigating", color: "#70b5fa" },
      { label: "Awaiting Customer Response", color: "#f2a150" },
      { label: "False Positive", color: "#00cc00" },
      { label: "True Positive", color: "#ff0000" },
    ];
    logger.info(
      `🧠 Generating executive summary with Azure OpenAI for ${customerDisplayName}...`
    );
    const executiveSummary = await generateExecutiveSummary(
      data,
      customerDisplayName
    );
    data.executiveSummary = executiveSummary;

    logger.info(`✅ Executive summary generated for ${customerDisplayName}`);
    // Return the data object
    return {
      reportMonth,
      customerDisplayName,
      incidentSeverityData,
      detectionSources: detectionChartLabels,
      incidentDetectionData,
      severityChartLabels,
      severityChartData,
      detectionChartLabels,
      detectionChartData,
      handlingStatusChartLabels,
      handlingStatusChartData,
      incidentHandlingStatusData,
      subStatusChartLabels,
      subStatusChartData,
      subStatusColors,
      subStatusLegend,
      incidentSubStatusData,
      incidentTickets: incidentTicketsData,
      healthTickets: healthTicketsData,
    };
  } catch (error) {
    logger.error(
      `❌ Error getting report data for ${customerDisplayName}:`,
      error
    );
    throw error;
  }
}

// Function to get report data for all customers
async function getReportData() {
  const allCustomersData = {};

  try {
    // Get report data for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(
      customers
    )) {
      try {
        const customerData = await getReportDataForCustomer(
          customerKey,
          customerDisplayName
        );
        allCustomersData[customerKey] = customerData;
      } catch (error) {
        logger.error(
          `❌ Failed to get report data for ${customerDisplayName}:`,
          error
        );
      }
    }

    return allCustomersData;
  } catch (error) {
    logger.error("❌ Error getting report data for all customers:", error);
    throw error;
  }
}

// API endpoint to get report status
async function getReportStatus(req, res) {
  try {
    const statusRecords = await getAllReportStatuses();

    const summary = {
      total: statusRecords.length,
      queued: statusRecords.filter((r) => r.status === "queued").length,
      generating: statusRecords.filter((r) => r.status === "generating").length,
      generated: statusRecords.filter((r) => r.status === "generated").length,
      uploading: statusRecords.filter((r) => r.status === "uploading").length,
      uploaded: statusRecords.filter((r) => r.status === "uploaded").length,
      verified: statusRecords.filter((r) => r.status === "verified").length,
      failed: statusRecords.filter((r) => r.status === "failed").length,
      retrying: statusRecords.filter((r) => r.status === "retrying").length,
      reports: statusRecords,
    };

    res.json(summary);
  } catch (error) {
    logger.error("❌ Error getting report status:", error);
    res.status(500).json({ error: "Failed to get report status" });
  }
}

// API endpoint to retry failed reports
async function retryFailedReports(req, res) {
  try {
    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();

    const failedReports = await ReportStatus.find({
      status: "failed",
      retryCount: { $lt: 3 },
    });

    const retryResults = [];

    for (const report of failedReports) {
      try {
        // Update status to retrying
        await updateReportStatus(report.reportId, {
          status: "retrying",
          retryCount: report.retryCount + 1,
        });

        // Schedule retry with exponential backoff
        const delayMs = Math.pow(3, report.retryCount) * 5 * 60 * 1000;

        setTimeout(async () => {
          try {
            await generateMonthlyReportForCustomer(
              report.customerKey,
              report.customerDisplayName,
              report.month,
              report.year,
              true // This is a retry
            );
          } catch (retryError) {
            logger.error(
              `❌ Retry failed for ${report.customerDisplayName} report:`,
              retryError
            );
          }
        }, delayMs);

        retryResults.push({
          reportId: report.reportId,
          customerKey: report.customerKey,
          customerDisplayName: report.customerDisplayName,
          month: report.month,
          year: report.year,
          status: "scheduled",
          retryCount: report.retryCount + 1,
        });
      } catch (error) {
        logger.error(
          `❌ Failed to schedule retry for ${report.customerDisplayName}:`,
          error
        );
        retryResults.push({
          reportId: report.reportId,
          customerKey: report.customerKey,
          customerDisplayName: report.customerDisplayName,
          month: report.year,
          status: "failed",
          error: error.message,
        });
      }
    }

    res.json({
      message: `Scheduled ${retryResults.filter((r) => r.status === "scheduled").length} reports for retry`,
      results: retryResults,
    });
  } catch (error) {
    logger.error("❌ Error retrying failed reports:", error);
    res.status(500).json({ error: "Failed to retry reports" });
  }
}

// NEW: Verification/Audit Job
async function verifyReportsIntegrity(req, res) {
  try {
    logger.info("🔍 Starting report integrity verification...");

    // Get the ReportStatus model
    const ReportStatus = getReportStatusModel();

    // Get all verified reports from DB
    const verifiedReports = await ReportStatus.find({ status: "verified" });

    // Get all blobs from container
    const blobList = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      blobList.push(blob.name);
    }

    // Compare DB records with blob storage
    const missingBlobs = [];
    const corruptedBlobs = [];
    const orphanedBlobs = [];

    // Check for missing or corrupted blobs
    for (const report of verifiedReports) {
      if (!blobList.includes(report.blobPath)) {
        missingBlobs.push({
          reportId: report.reportId,
          customerKey: report.customerKey,
          customerDisplayName: report.customerDisplayName,
          month: report.month,
          year: report.year,
          blobPath: report.blobPath,
        });
      } else {
        // Verify checksum if available
        if (report.checksum) {
          const isValid = await verifyBlob(report.blobPath, report.checksum);
          if (!isValid) {
            corruptedBlobs.push({
              reportId: report.reportId,
              customerKey: report.customerKey,
              customerDisplayName: report.customerDisplayName,
              month: report.month,
              year: report.year,
              blobPath: report.blobPath,
              expectedChecksum: report.checksum,
            });
          }
        }
      }
    }

    // Check for orphaned blobs (blobs without corresponding DB records)
    const dbBlobPaths = verifiedReports.map((r) => r.blobPath);
    for (const blobPath of blobList) {
      if (!dbBlobPaths.includes(blobPath)) {
        orphanedBlobs.push({
          blobPath,
        });
      }
    }

    const verificationResults = {
      totalReports: verifiedReports.length,
      totalBlobs: blobList.length,
      missingBlobs: missingBlobs.length,
      corruptedBlobs: corruptedBlobs.length,
      orphanedBlobs: orphanedBlobs.length,
      missingBlobsDetails: missingBlobs,
      corruptedBlobsDetails: corruptedBlobs,
      orphanedBlobsDetails: orphanedBlobs,
      verifiedAt: new Date().toISOString(),
    };

    // Log verification results
    logger.info(
      `🔍 Verification completed: ${verificationResults.totalReports} reports, ${verificationResults.totalBlobs} blobs`
    );
    logger.info(`❌ Missing blobs: ${verificationResults.missingBlobs}`);
    logger.info(`❌ Corrupted blobs: ${verificationResults.corruptedBlobs}`);
    logger.info(`⚠️ Orphaned blobs: ${verificationResults.orphanedBlobs}`);

    // If there are issues, send alert
    if (missingBlobs.length > 0 || corruptedBlobs.length > 0) {
      // TODO: Implement alert mechanism (email, Slack, etc.)
      logger.error("🚨 ALERT: Report integrity issues detected!");
    }

    res.json(verificationResults);
  } catch (error) {
    logger.error("❌ Error verifying report integrity:", error);
    res.status(500).json({ error: "Failed to verify report integrity" });
  }
}

// NEW: Schedule verification job
function scheduleReportVerification() {
  // Run daily at 2 AM
  schedule.scheduleJob("0 2 * * *", async () => {
    try {
      await verifyReportsIntegrity();
    } catch (error) {
      logger.error("❌ Error in scheduled report verification:", error);
    }
  });

  logger.info("🔍 Report integrity verification scheduled for daily at 2 AM");
}

// Schedule: Run on 1st of every month at 00:00
function scheduleMonthlyReport() {
  // Default to "0 0 2 * *" (2nd of every month at 00:00) if not set in .env
  const cronSchedule = process.env.MONTHLY_REPORT_CRON || "0 0 5 * *";

  schedule.scheduleJob(cronSchedule, () => {
    generateMonthlyReport();
  });
  logger.info(
    "📅 Monthly report generation scheduled for 2nd of every month at 00:00 for all customers (previous month)"
  );
}

// Add connection health check function
async function checkReportsDBHealth() {
  try {
    if (!isReportsDBConnected) {
      return {
        status: "unhealthy",
        message: "Reports database connection is not ready",
        readyState: isReportsDBConnected
          ? reportsDBConnection.readyState
          : "not established",
      };
    }

    // Ping the database
    await reportsDBConnection.db.admin().ping();

    return {
      status: "healthy",
      message: "Reports MongoDB connection is healthy",
      readyState: reportsDBConnection.readyState,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: `Reports MongoDB health check failed: ${error.message}`,
      readyState: isReportsDBConnected
        ? reportsDBConnection.readyState
        : "not established",
    };
  }
}

// Event listeners for real-time monitoring
reportGenerationEvents.on("reportStarted", (data) => {
  logger.info(
    `🚀 Started generating report for ${data.customerDisplayName} (${data.month}/${data.year})`
  );
});

reportGenerationEvents.on("reportCompleted", (data) => {
  logger.info(
    `✅ Completed report for ${data.customerDisplayName} (${data.month}/${data.year}): ${data.blobUrl}`
  );
});

reportGenerationEvents.on("reportFailed", (data) => {
  logger.error(
    `❌ Failed report for ${data.customerDisplayName} (${data.month}/${data.year}): ${data.error}`
  );
  if (data.retryCount < data.maxRetries) {
    logger.info(`🔄 Will retry (${data.retryCount}/${data.maxRetries})`);
  } else {
    logger.error(
      `💀 Max retries reached for ${data.customerDisplayName} (${data.month}/${data.year})`
    );
  }
});

// Function to generate reports for the last 5 months for all customers
async function generateLast5MonthsReports() {
  logger.info(
    "📅 Starting report generation for the last 5 months for all customers..."
  );
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    reports: [],
    errors: [],
  };

  try {
    const now = new Date();

    // Generate report for each customer
    for (const [customerKey, customerDisplayName] of Object.entries(
      customers
    )) {
      try {
        // Generate reports for the last 5 months
        for (let i = 0; i < 5; i++) {
          const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const month = targetDate.getMonth() + 1;
          const year = targetDate.getFullYear();
          const reportId = `${customerKey}_${month}_${year}`;
          results.total++;

          // Get the ReportStatus model
          const ReportStatus = getReportStatusModel();
          const existingReport = await ReportStatus.findOne({ reportId });

          // Check if report exists and is verified AND blob actually exists
          if (existingReport && existingReport.status === "verified") {
            // Verify blob actually exists before skipping
            const blobExists = await verifyBlob(existingReport.blobPath, null);
            if (blobExists) {
              results.successful++;
              results.reports.push({
                reportId,
                customerKey,
                customerDisplayName,
                month,
                year,
                blobUrl: existingReport.blobUrl,
                status: "verified",
                timestamp: existingReport.verifiedAt,
              });

              logger.info(
                `⏭️ Skipping already verified report for ${customerDisplayName} (${month}/${year})`
              );
              continue;
            } else {
              // Blob doesn't exist, update status to failed and continue with generation
              logger.warn(
                `⚠️ Report ${reportId} marked as verified but blob is missing. Regenerating...`
              );
              await updateReportStatus(reportId, {
                status: "failed",
                error: "Blob file is missing from storage",
              });
            }
          }

          // If report exists but failed, and we haven't reached max retries, skip
          if (
            existingReport &&
            existingReport.status === "failed" &&
            existingReport.retryCount >= existingReport.maxRetries
          ) {
            results.failed++;
            results.errors.push({
              reportId,
              customerKey,
              customerDisplayName,
              month,
              year,
              error: existingReport.error,
              status: "failed",
              timestamp: existingReport.updatedAt,
            });

            logger.info(
              `⏭️ Skipping failed report for ${customerDisplayName} (${month}/${year}) - max retries reached`
            );
            continue;
          }

          // If report is pending or processing, count it and continue
          if (
            existingReport &&
            (existingReport.status === "queued" ||
              existingReport.status === "generating" ||
              existingReport.status === "generated" ||
              existingReport.status === "uploading" ||
              existingReport.status === "uploaded" ||
              existingReport.status === "retrying")
          ) {
            if (existingReport.status === "queued") results.pending++;
            else if (
              existingReport.status === "generating" ||
              existingReport.status === "generated" ||
              existingReport.status === "uploading" ||
              existingReport.status === "uploaded" ||
              existingReport.status === "retrying"
            )
              results.processing++;

            results.reports.push({
              reportId,
              customerKey,
              customerDisplayName,
              month,
              year,
              status: existingReport.status,
              timestamp: existingReport.updatedAt,
            });

            logger.info(
              `⏭️ Skipping ${existingReport.status} report for ${customerDisplayName} (${month}/${year})`
            );
            continue;
          }

          try {
            // Generate the report
            const reportResult = await generateMonthlyReportForCustomer(
              customerKey,
              customerDisplayName,
              month,
              year
            );

            // Only count as successful if status is verified
            if (reportResult.status === "verified") {
              results.successful++;
            } else {
              results.failed++;
            }

            results.reports.push({
              reportId,
              customerKey,
              customerDisplayName,
              month,
              year,
              blobUrl: reportResult.blobUrl,
              status: reportResult.status || "verified",
              timestamp: new Date().toISOString(),
            });

            logger.info(
              `✅ Generated report for ${customerDisplayName} (${month}/${year}) with status: ${reportResult.status || "verified"}`
            );
          } catch (error) {
            results.failed++;
            results.errors.push({
              reportId,
              customerKey,
              customerDisplayName,
              month,
              year,
              error: error.message,
              status: "failed",
              timestamp: new Date().toISOString(),
            });

            logger.error(
              `❌ Failed to generate report for ${customerDisplayName} (${month}/${year}):`,
              error
            );
          }
        }
      } catch (error) {
        logger.error(
          `❌ Failed to process reports for ${customerDisplayName}:`,
          error
        );
      }
    }

    logger.info(
      `📊 Report generation summary: ${results.successful}/${results.total} successful, ${results.failed} failed, ${results.pending} pending, ${results.processing} processing`
    );

    return results;
  } catch (error) {
    logger.error(
      "❌ Error generating reports for the last 5 months for all customers:",
      error
    );
    throw error;
  }
}

export {
  generateMonthlyReport,
  generateAllHistoricalReports,
  generateLast5MonthsReports,
  getReportData,
  getReportStatus,
  retryFailedReports,
  verifyReportsIntegrity,
  scheduleMonthlyReport,
  scheduleReportVerification,
  checkReportsDBHealth,
  customers,
  reportGenerationEvents,
};