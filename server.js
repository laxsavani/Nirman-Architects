require('./utils/logger');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const routes = require('./routes');
const loggerMiddleware = require('./middlewares/logger.middleware');
const urlSanitizer = require('./middlewares/urlSanitizer.middleware');
const dbConnector = require('./middlewares/dbConnector.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const startHeartbeatChecker = require('./utils/heartbeatChecker');
const initHeartbeatTimeoutCron = require('./cron/heartbeatTimeoutCron');
const initPayrollGenerationCron = require('./cron/payrollGenerationCron');
const { initLeadFollowUpCron } = require('./cron/leadFollowUpCron');
const { setupSwagger, swaggerSpec } = require('./config/swagger');
const { getStorageRoot } = require('./utils/storagePathResolver');

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Enable Swagger UI & static storage assets
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(mongoSanitize({ replaceWith: '_' })); // Prevent NoSQL Injection
app.use(urlSanitizer);
app.use(loggerMiddleware); // Global request logger middleware
app.use(dbConnector);       // Dynamic on-demand database connector

// Static file serving for storage root (/storage/offer_letters, /storage/salary, /storage/screenshots)
app.use('/storage', express.static(getStorageRoot()));

// Setup Interactive Swagger UI at /api-docs and redirect from /docs
setupSwagger(app);

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Root Route (Welcome & API status for Render health checks)
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Nirman Architects Attendance HRM API',
    status: 'running',
    documentation: '/api-docs',
    endpoints: {
      health: '/api/health',
      swaggerSpec: '/api-docs.json'
    }
  });
});

// Routes
app.use('/api', routes);

// Global Error Handler (must be registered last)
app.use(errorMiddleware);

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Nirman Architects API Server is running!`);
  console.log(`👉 Portal:       http://localhost:${PORT}`);
  console.log(`👉 Swagger UI:   http://localhost:${PORT}/api-docs`);
  console.log(`👉 Storage Root: http://localhost:${PORT}/storage`);
  console.log(`====================================================`);
});

// Asynchronously trigger DB connection in background and start cron workers
connectDB().then((conn) => {
  if (conn) {
    startHeartbeatChecker();
    initHeartbeatTimeoutCron();
    initPayrollGenerationCron();
    initLeadFollowUpCron();
    console.log(`✅ HRM & CRM Background workers & Crons initialized.`);
  } else {
    console.warn(`⚠️ Background workers delayed: Database connection was not established.`);
  }
});