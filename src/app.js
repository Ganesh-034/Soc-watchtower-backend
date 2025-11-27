import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";

// Routes
import incidentRoutes from "./routes/incident.routes.js";
import incidentTicketRoutes from "./routes/incidentTicket.routes.js";
import incidentSeverityRoutes from "./routes/incident.severity.routes.js";
import incidentDSRoutes from "./routes/incidentDS.routes.js";
import incidentViewRoutes from "./routes/incidentView.routes.js";
import incidentHSRoutes from "./routes/incidentHS.routes.js";
import incidentSSRoutes from "./routes/incidentSS.routes.js";
import reportRoutes from "./routes/report.routes.js";
import incidentTicketReportRoutes from "./routes/incidentTicketReport.routes.js";
import reportDownloadRoutes from "./routes/reportDownload.routes.js";

const app = express();

const allowedOrigins = [
  "https://www.soc-watchtower.com",
  "https://soc-watchtower.com",
  "https://soc-watchtower-frontend.azurestaticapps.net"
];

// Disable ETag (no caching)
app.disable("etag");

// ✅ Security middleware
app.use(helmet());

// ✅ CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow Postman/cURL
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// ✅ Body parser
app.use(express.json());

// ✅ Compression
app.use(compression());

// ✅ Logging
app.use(morgan("dev"));

// ✅ Routes
app.use("/api", incidentRoutes);
app.use("/api", incidentTicketRoutes);
app.use("/api", incidentSeverityRoutes);
app.use("/api", incidentDSRoutes);
app.use("/api", incidentViewRoutes);
app.use("/api", incidentHSRoutes);
app.use("/api", incidentSSRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api", incidentTicketReportRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reports", reportDownloadRoutes);

// ✅ 404 handler
app.use(notFound);

// ✅ Global error handler
app.use(errorHandler);

export default app;
