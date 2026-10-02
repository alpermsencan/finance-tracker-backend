import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../types';

const router = Router();

// POST /api/budgets -> Create a budget limit
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { category, limitAmount, currency = 'TRY', startDate, endDate } = req.body;

    if (!category || !limitAmount || !startDate || !endDate) {
      return res.status(400).json({ error: 'category, limitAmount, startDate, and endDate are required.' });
    }

    const query = `
      INSERT INTO budgets (user_id, category, limit_amount, currency, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, category, start_date, end_date) DO UPDATE
      SET limit_amount = EXCLUDED.limit_amount
      RETURNING id, category, limit_amount as "limitAmount", currency, start_date as "startDate", end_date as "endDate";
    `;

    const result = await pool.query(query, [userId, category, limitAmount, currency, startDate, endDate]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/budgets -> List budgets with current spent and warning
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const query = `
      SELECT 
        b.id,
        b.category,
        b.limit_amount AS "limitAmount",
        b.currency,
        b.start_date AS "startDate",
        b.end_date AS "endDate",
        COALESCE(SUM(t.amount), 0) AS "currentSpent"
      FROM budgets b
      LEFT JOIN transactions t 
        ON t.user_id = b.user_id 
       AND t.category = b.category 
       AND t.type = 'expense'
       AND t.date BETWEEN b.start_date AND b.end_date
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);

    const budgetsWithProgress = result.rows.map((row) => {
      const limit = parseFloat(row.limitAmount);
      const spent = parseFloat(row.currentSpent);
      const percentage = limit > 0 ? Number(((spent / limit) * 100).toFixed(1)) : 0;

      return {
        id: row.id,
        category: row.category,
        limitAmount: limit,
        currentSpent: spent,
        remainingAmount: Math.max(0, limit - spent),
        progressPercentage: percentage,
        warning: percentage >= 100 ? 'Bütçe aşıldı!' : percentage >= 80 ? '%80 aşıldı!' : null,
      };
    });

    return res.status(200).json(budgetsWithProgress);
  } catch (error) {
    next(error);
  }
});

export default router;
