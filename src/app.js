import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import incidentRoutes from "./routes/incident.routes.js";
import incidentTicketRoutes from "./routes/incidentTicket.routes.js"; 
import incidentSeverityRoutes from "./routes/incident.severity.routes.js"; 
import incidentDSRoutes from "./routes/incidentDS.routes.js";
import incidentViewRoutes from "./routes/incidentView.routes.js";
import incidentHSRoutes from "./routes/incidentHS.routes.js";
import incidentSSRoutes from "./routes/incidentSS.routes.js";
import reportRoutes from "./routes/report.routes.js"

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(morgan("dev"));

// Routes
app.use("/api", incidentRoutes);
app.use("/api", incidentTicketRoutes); 
app.use("/api", incidentSeverityRoutes); 
app.use("/api", incidentDSRoutes);
app.use("/api", incidentViewRoutes);
app.use("/api", incidentHSRoutes);
app.use("/api", incidentSSRoutes);
app.use("/api/incidents", incidentRoutes); // Assuming this already exists
app.use("/api/reports", reportRoutes); // Add this line
// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;