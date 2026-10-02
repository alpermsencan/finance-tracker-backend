import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../types';
import { checkBudgetThresholdAndAlert } from '../services/budgetAlerts';

const router = Router();

// GET /api/transactions -> List transactions
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const query = `
      SELECT 
        id, 
        user_id as "userId", 
        type, 
        amount, 
        currency, 
        category, 
        date, 
        description, 
        created_at as "createdAt"
      FROM transactions
      WHERE user_id = $1
      ORDER BY date DESC, created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [userId, limit]);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/transactions -> Add income or expense
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { type, amount, currency = 'TRY', category, date, description, billId, budgetId } = req.body;

    if (!type || !amount || !category) {
      return res.status(400).json({ error: 'type, amount, and category are required.' });
    }

    const txDate = date || new Date().toISOString().split('T')[0];

    const query = `
      INSERT INTO transactions (user_id, bill_id, budget_id, type, amount, currency, category, date, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, user_id as "userId", type, amount, currency, category, date, description, created_at as "createdAt";
    `;

    const result = await pool.query(query, [
      userId,
      billId || null,
      budgetId || null,
      type,
      amount,
      currency,
      category,
      txDate,
      description || null,
    ]);

    const createdTx = result.rows[0];

    // If expense, check budget limit thresholds and notify
    if (type === 'expense') {
      checkBudgetThresholdAndAlert(userId, category, amount, txDate);
    }

    return res.status(201).json(createdTx);
  } catch (error) {
    next(error);
  }
});

// GET /api/transactions/balance -> Monthly balance summary
router.get('/balance', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);

    const startDate = `${month}-01`;
    const [year, m] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, m, 1);
    const endDate = nextMonthDate.toISOString().split('T')[0];

    const query = `
      SELECT 
        type, 
        category, 
        COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE user_id = $1 AND date >= $2 AND date < $3
      GROUP BY type, category;
    `;
    const result = await pool.query(query, [userId, startDate, endDate]);

    let incomeTotal = 0;
    let expenseTotal = 0;
    const categories: Record<string, number> = {};

    result.rows.forEach((row) => {
      const amt = parseFloat(row.total);
      if (row.type === 'income') {
        incomeTotal += amt;
      } else {
        expenseTotal += amt;
        categories[row.category] = (categories[row.category] || 0) + amt;
      }
    });

    return res.status(200).json({
      month,
      incomeTotal: Number(incomeTotal.toFixed(2)),
      expenseTotal: Number(expenseTotal.toFixed(2)),
      netBalance: Number((incomeTotal - expenseTotal).toFixed(2)),
      categories,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
