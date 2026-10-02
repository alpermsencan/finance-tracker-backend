import * as admin from 'firebase-admin';
import { pool } from '../db';

export async function checkBudgetThresholdAndAlert(
  userId: string,
  category: string,
  _txAmount: number,
  txDate: string
): Promise<void> {
  try {
    const budgetQuery = `
      SELECT id, limit_amount as "limitAmount", currency
      FROM budgets
      WHERE user_id = $1 
        AND category = $2 
        AND $3::date BETWEEN start_date AND end_date
      LIMIT 1;
    `;
    const budgetRes = await pool.query(budgetQuery, [userId, category, txDate]);

    if (budgetRes.rows.length === 0) return;

    const budget = budgetRes.rows[0];
    const limit = parseFloat(budget.limitAmount);

    const spentQuery = `
      SELECT COALESCE(SUM(amount), 0) AS total_spent
      FROM transactions
      WHERE user_id = $1 
        AND category = $2 
        AND type = 'expense'
        AND date >= (SELECT start_date FROM budgets WHERE id = $3)
        AND date <= (SELECT end_date FROM budgets WHERE id = $3);
    `;
    const spentRes = await pool.query(spentQuery, [userId, category, budget.id]);
    const totalSpent = parseFloat(spentRes.rows[0].total_spent);
    const ratio = totalSpent / limit;

    let alertTitle = '';
    let alertBody = '';

    if (ratio >= 1.0) {
      alertTitle = '🚨 Bütçe Limiti Aşıldı!';
      alertBody = `${category} kategorisinde bütçenizi %100 aştınız! (${totalSpent.toFixed(0)} / ${limit.toFixed(0)} TL)`;
    } else if (ratio >= 0.8) {
      alertTitle = '⚠️ Bütçe Uyarısı';
      alertBody = `${category} kategorisinde bütçenizin %${Math.round(ratio * 100)}'ine ulaştınız! (${totalSpent.toFixed(0)} / ${limit.toFixed(0)} TL)`;
    }

    if (alertTitle && admin.apps.length > 0) {
      const userRes = await pool.query('SELECT fcm_token as "fcmToken" FROM users WHERE id = $1', [userId]);
      const fcmToken = userRes.rows[0]?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title: alertTitle, body: alertBody },
          data: { type: 'budget_alert', category, budgetId: String(budget.id) },
        });
        console.log(`[Budget Alert] ${category} -> %${Math.round(ratio * 100)} sent to FCM.`);
      }
    }
  } catch (err) {
    console.warn('[Budget Alert] Error during budget check:', err);
  }
}
