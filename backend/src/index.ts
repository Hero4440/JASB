import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import draftsRoutes from './routes/drafts';
import expensesRoutes from './routes/expenses';
import groupRoutes from './routes/groups';
// Register API routes
import userRoutes from './routes/users';
import { handleCustomErrors } from './validation';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
      },
    },
  },
  genReqId: () => uuidv4(),
});

// Register plugins
app.register(helmet, {
  contentSecurityPolicy: false, // Disable CSP for API
});

app.register(cors, {
  origin:
    process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://jasb.app']
      : true, // Allow all origins in development
  credentials: true,
});

// Health check endpoint
app.get('/healthz', async (_request, _reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };
});

app.register(userRoutes);
app.register(groupRoutes);
app.register(expensesRoutes);
app.register(draftsRoutes);

// Global error handler
app.setErrorHandler((error, request, reply) => {
  // Try to handle custom errors first
  try {
    handleCustomErrors(error, request, reply);
    return;
  } catch (e) {
    // Fall through to default handler
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';

  // Log error details
  request.log.error(
    {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      reqId: request.id,
    },
    'Request error',
  );

  // Send error response
  reply.status(statusCode).send({
    code,
    message: error.message,
    details:
      process.env.NODE_ENV === 'development'
        ? {
            stack: error.stack,
            reqId: request.id,
          }
        : undefined,
  });
});

// 404 handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    code: 'NOT_FOUND',
    message: `Route ${request.method} ${request.url} not found`,
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    console.log(`🚀 JASB Backend API running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/healthz`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  app.log.info('SIGTERM received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('SIGINT received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

if (require.main === module) {
  start();
}

export default app;
