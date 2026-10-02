import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { initializeDatabase } from './db';
import { authMiddleware } from './middleware/auth';
import { startBillReminderCron } from './services/billReminder.service';

import billsRouter from './routes/bills';
import transactionsRouter from './routes/transactions';
import savingsRouter from './routes/savings';
import currencyRouter from './routes/currency';
import budgetsRouter from './routes/budgets';
import subscriptionsRouter from './routes/subscriptions';
import exportRouter from './routes/export';

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middlewares
app.use(cors());
app.use(express.json());

// Public Health Check (Required by Railway)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root welcome
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Finance Tracker API',
    version: '1.0.0',
    documentation: '/health',
  });
});

// Public / Cached Endpoints
app.use('/api/currency', currencyRouter);

// Authenticated Endpoints
app.use('/api/bills', authMiddleware, billsRouter);
app.use('/api/transactions', authMiddleware, transactionsRouter);
app.use('/api/savings', authMiddleware, savingsRouter);
app.use('/api/budgets', authMiddleware, budgetsRouter);
app.use('/api/subscriptions', authMiddleware, subscriptionsRouter);
app.use('/api/export', authMiddleware, exportRouter);

// 404 Route Not Found
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint Not Found' });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]:', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

// Initialize DB and launch server
initializeDatabase().finally(() => {
  startBillReminderCron();
  app.listen(PORT, () => {
    console.log(`[Finance Backend] Running on http://localhost:${PORT}`);
  });
});

export default app;
