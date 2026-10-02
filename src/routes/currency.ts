import { Router, Request, Response } from 'express';
import { getOrFetchDailyRates, convertCurrency } from '../services/currency.service';

const router = Router();

// GET /api/currency/rates -> Returns cached daily rates (TRY base)
router.get('/rates', async (_req: Request, res: Response) => {
  try {
    const rates = await getOrFetchDailyRates();
    return res.status(200).json(rates);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch currency rates.' });
  }
});

// GET /api/currency/convert?amount=100&from=USD&to=TRY
router.get('/convert', async (req: Request, res: Response) => {
  try {
    const amount = parseFloat(req.query.amount as string) || 0;
    const from = (req.query.from as string) || 'USD';
    const to = (req.query.to as string) || 'TRY';

    const result = await convertCurrency(amount, from, to);
    return res.status(200).json({ amount, from, to, result });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Conversion error' });
  }
});

export default router;
