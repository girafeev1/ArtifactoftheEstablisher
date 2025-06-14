// functions/src/index.ts
import * as functions from 'firebase-functions';
import { logger } from 'firebase-functions';
import express, { Request, Response } from 'express';

// Import Next.js API route handlers
import authHandler from '../../pages/api/auth/[...nextauth]';
import businessesHandler from '../../pages/api/businesses/index';
import businessFileHandler from '../../pages/api/businesses/[fileId]';
import clientsHandler from '../../pages/api/clients';
import databaseHandler from '../../pages/api/database';
import infoHandler from '../../pages/api/info';
import createInvoiceHandler from '../../pages/api/invoices/createInvoice';

// Create express app
const app = express();

app.use(express.json());
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Map routes to handlers
app.all('/api/auth/*', (req: Request, res: Response) => authHandler(req as any, res as any));
app.all('/api/businesses', (req: Request, res: Response) => businessesHandler(req as any, res as any));
app.all('/api/businesses/:fileId', (req: Request, res: Response) => businessFileHandler(req as any, res as any));
app.all('/api/clients', (req: Request, res: Response) => clientsHandler(req as any, res as any));
app.all('/api/database', (req: Request, res: Response) => databaseHandler(req as any, res as any));
app.all('/api/info', (req: Request, res: Response) => infoHandler(req as any, res as any));
app.all('/api/invoices/createInvoice', (req: Request, res: Response) => createInvoiceHandler(req as any, res as any));

// Export the Firebase HTTPS function
export const api = functions.region('us-central1').https.onRequest(app);
