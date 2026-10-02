import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../types';
import { getOrFetchDailyRates } from '../services/currency.service';

const router = Router();

// GET /api/savings -> List user savings goals
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const query = `
      SELECT 
        id, 
        user_id as "userId", 
        name, 
        target_amount as "targetAmount", 
        target_currency as "targetCurrency", 
        current_amount as "currentAmount", 
        start_date as "startDate",
        created_at as "createdAt"
      FROM savings
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/savings -> Create a new savings goal
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { name, targetAmount, targetCurrency = 'TRY', currentAmount = 0, startDate } = req.body;

    if (!name || !targetAmount) {
      return res.status(400).json({ error: 'name and targetAmount are required.' });
    }

    const query = `
      INSERT INTO savings (user_id, name, target_amount, target_currency, current_amount, start_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, target_amount as "targetAmount", target_currency as "targetCurrency", current_amount as "currentAmount", start_date as "startDate";
    `;

    const result = await pool.query(query, [
      userId,
      name,
      targetAmount,
      targetCurrency,
      currentAmount,
      startDate || new Date().toISOString().split('T')[0],
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/savings/:id/progress -> Goal progress analytics, ETA, and currency valuation
router.get('/:id/progress', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const savingsId = req.params.id;

    const query = `
      SELECT 
        id, 
        user_id as "userId", 
        name, 
        target_amount as "targetAmount", 
        target_currency as "targetCurrency", 
        current_amount as "currentAmount", 
        start_date as "startDate"
      FROM savings
      WHERE id = $1 AND user_id = $2;
    `;
    const result = await pool.query(query, [savingsId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Savings goal not found.' });
    }

    const goal = result.rows[0];
    const target = parseFloat(goal.targetAmount);
    const current = parseFloat(goal.currentAmount);

    const rates = await getOrFetchDailyRates();

    const progressPercentage = target > 0 ? Number(((current / target) * 100).toFixed(1)) : 100;
    const remaining = Math.max(0, target - current);

    const startDate = new Date(goal.startDate);
    const daysActive = Math.max(1, Math.round((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyVelocity = current > 0 ? current / daysActive : 150;

    const etaDays = remaining > 0 ? Math.ceil(remaining / dailyVelocity) : 0;
    const currentValueInUSD = rates.usdToTry > 0 ? Number((current / rates.usdToTry).toFixed(2)) : 0;
    const currentValueInGold = rates.goldPerGram > 0 ? Number((current / rates.goldPerGram).toFixed(3)) : 0;

    return res.status(200).json({
      savingsId: goal.id,
      name: goal.name,
      targetAmount: target,
      currentAmount: current,
      progressPercentage,
      targetCurrency: goal.targetCurrency,
      currentValueInUSD,
      currentValueInGold,
      etaDays,
      dailySavingsGoal: Number(dailyVelocity.toFixed(2)),
      currencyRates: rates,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
