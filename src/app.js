// import express from "express";
// import helmet from "helmet";
// import cors from "cors";
// import compression from "compression";
// import morgan from "morgan";
// import { errorHandler } from "./middlewares/errorHandler.js";
// import { notFound } from "./middlewares/notFound.js";
// import userRoutes from "./routes/user.routes.js";

// const app = express();

// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(compression());
// app.use(morgan("dev"));

// // Routes
// app.use("/api/users", userRoutes);

// // 404 handler
// app.use(notFound);

// // Global error handler
// app.use(errorHandler);

// export default app;




import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import userRoutes from "./routes/user.routes.js";
import incidentRoutes from "./routes/incident.routes.js"; // Add this line

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(morgan("dev"));

// Routes
app.use("/api/users", userRoutes);
app.use("/api", incidentRoutes); // Add this line to include incident routes

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;