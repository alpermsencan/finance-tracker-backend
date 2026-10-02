import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET /api/export/csv?month=2026-10 -> Export monthly transactions to CSV
router.get('/csv', async (req: AuthenticatedRequest, res: Response, next) => {
  const userId = req.user!.id;
  const monthStr = (req.query.month as string) || new Date().toISOString().substring(0, 7);

  const startDate = `${monthStr}-01`;
  const [year, m] = monthStr.split('-').map(Number);
  const nextMonthDate = new Date(year, m, 1);
  const endDate = nextMonthDate.toISOString().split('T')[0];

  try {
    const query = `
      SELECT 
        date,
        type,
        category,
        amount,
        currency,
        COALESCE(description, '') as description
      FROM transactions
      WHERE user_id = $1 AND date >= $2 AND date < $3
      ORDER BY date DESC;
    `;
    const { rows } = await pool.query(query, [userId, startDate, endDate]);

    let csvContent = '\uFEFFTarih;İşlem Türü;Kategori;Tutar;Para Birimi;Açıklama\r\n';

    rows.forEach((row) => {
      const dateFormatted = new Date(row.date).toLocaleDateString('tr-TR');
      const typeText = row.type === 'income' ? 'Gelir' : 'Gider';
      csvContent += `${dateFormatted};${typeText};${row.category};${row.amount};${row.currency};"${row.description}"\r\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Gelir-Gider-${monthStr}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
});

export default router;
