import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import incidentRoutes from "./routes/incident.routes.js";
import incidentcustomerRoutes from "./routes/incident.customer.routes.js";
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

// To disable server side caching
app.disable("etag");

// Allowed origins for CORS
const allowedOrigins = [
  'https://www.soc-watchtower.com',
  'https://soc-watchtower.com',
  'http://localhost:5173'
];

// Configure CORS options with dynamic origin check
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) {
      // Allow requests with no origin (like Postman or curl)
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

// Use CORS middleware
app.use(cors(corsOptions));

// Security and utility middlewares
app.use(helmet());
app.use(express.json());
app.use(compression());
app.use(morgan("dev"));

// API Routes
app.use("/api", incidentRoutes);
app.use("/api", incidentcustomerRoutes);
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

// 404 handler for unmatched routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;