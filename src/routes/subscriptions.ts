import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../types';

const router = Router();

// POST /api/subscriptions/:id/pay-and-rollover -> Pay recurring bill and generate next month's bill
router.post('/:id/pay-and-rollover', async (req: AuthenticatedRequest, res: Response, next) => {
  const userId = req.user!.id;
  const billId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Mark bill paid
    const updateBillQuery = `
      UPDATE bills 
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const billRes = await client.query(updateBillQuery, [billId, userId]);
    if (billRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found.' });
    }

    const paidBill = billRes.rows[0];

    // 2. Insert into transactions
    const txQuery = `
      INSERT INTO transactions (user_id, bill_id, type, amount, currency, category, date, description)
      VALUES ($1, $2, 'expense', $3, $4, $5, CURRENT_DATE, $6);
    `;
    await client.query(txQuery, [
      userId,
      paidBill.id,
      paidBill.amount,
      paidBill.currency,
      paidBill.vendor_category || 'Abonelik',
      `${paidBill.vendor_name || paidBill.title} faturası ödendi`,
    ]);

    // 3. If recurring, generate next cycle
    let nextBill = null;
    if (paidBill.recurrence_interval === 'monthly') {
      const currentDueDate = new Date(paidBill.due_date);
      const nextDueDate = new Date(currentDueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);

      const nextBillQuery = `
        INSERT INTO bills (user_id, title, vendor_name, vendor_category, amount, currency, due_date, recurrence_interval, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING *;
      `;
      const nextRes = await client.query(nextBillQuery, [
        userId,
        paidBill.title,
        paidBill.vendor_name,
        paidBill.vendor_category,
        paidBill.amount,
        paidBill.currency,
        nextDueDate.toISOString().split('T')[0],
        'monthly',
      ]);
      nextBill = nextRes.rows[0];
    }

    await client.query('COMMIT');
    return res.status(200).json({
      message: 'Fatura ödendi ve sonraki dönem oluşturuldu.',
      paidBill,
      nextRecurringBill: nextBill,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
