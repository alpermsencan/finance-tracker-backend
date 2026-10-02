import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET /api/bills/upcoming -> Returns bills due in 1-3 days
router.get('/upcoming', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string, 10) || 3;

    const query = `
      SELECT 
        id, 
        user_id as "userId",
        COALESCE(title, vendor_name) as "title",
        vendor_name as "vendorName", 
        vendor_category as "vendorCategory",
        amount, 
        currency, 
        due_date as "dueDate", 
        status, 
        invoice_pdf_url as "invoicePdfUrl",
        (due_date - CURRENT_DATE) as "daysRemaining"
      FROM bills
      WHERE user_id = $1 
        AND status = 'pending'
        AND due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($2 || ' days')::INTERVAL)
      ORDER BY due_date ASC;
    `;

    const result = await pool.query(query, [userId, days]);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/bills -> List all user bills
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const status = req.query.status as string;

    let query = `
      SELECT 
        id, 
        user_id as "userId",
        COALESCE(title, vendor_name) as "title",
        vendor_name as "vendorName", 
        vendor_category as "vendorCategory",
        amount, 
        currency, 
        due_date as "dueDate", 
        status, 
        recurrence_interval as "recurrenceInterval",
        invoice_pdf_url as "invoicePdfUrl",
        created_at as "createdAt"
      FROM bills
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY due_date ASC;';

    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/bills -> Add a new bill
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { vendorName, vendor, title, amount, currency = 'TRY', dueDate, vendorCategory = 'General', recurrenceInterval, invoicePdfUrl } = req.body;

    const actualVendor = vendorName || vendor;
    if (!actualVendor || !amount || !dueDate) {
      return res.status(400).json({ error: 'vendorName, amount, and dueDate are required.' });
    }

    const query = `
      INSERT INTO bills (user_id, title, vendor_name, vendor_category, amount, currency, due_date, status, recurrence_interval, invoice_pdf_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
      RETURNING id, user_id as "userId", title, vendor_name as "vendorName", amount, currency, due_date as "dueDate", status, created_at as "createdAt";
    `;

    const result = await pool.query(query, [
      userId,
      title || actualVendor,
      actualVendor,
      vendorCategory,
      amount,
      currency,
      dueDate,
      recurrenceInterval || null,
      invoicePdfUrl || null,
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/bills/:id/pay -> Mark bill as paid
router.patch('/:id/pay', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const billId = req.params.id;

    const query = `
      UPDATE bills
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, vendor_name as "vendorName", amount, currency, status, paid_at as "paidAt";
    `;

    const result = await pool.query(query, [billId, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
