import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import personRoutes from './routes/person';
import analyticsRoutes from './routes/analytics';
import pharmacyRoutes from './routes/pharmacy';

dotenv.config();

// Load Swagger document
// In production, swagger.yaml is copied to dist/ alongside index.js
// In development with ts-node, __dirname is src/, so we look in parent directory
const swaggerPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'swagger.yaml')
  : path.join(__dirname, '..', 'swagger.yaml');
const swaggerDocument = YAML.load(swaggerPath);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital';

// Middleware
app.use(cors());
app.use(express.json());

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Hospital API Documentation'
}));

// Routes
app.get('/', (_req, res) => {
  res.json({ message: 'Hospital Backend API', status: 'ok', docs: '/api-docs' });
});

// Health check endpoint for Docker/Kubernetes
app.get('/health', async (_req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const isDbConnected = dbState === 1; // 1 = connected

    if (isDbConnected) {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected'
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected'
      });
    }
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/person', personRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pharmacy', pharmacyRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

// Start server first, then connect to database
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/api-docs`);
});

// Database connection (non-blocking)
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

export default app;
