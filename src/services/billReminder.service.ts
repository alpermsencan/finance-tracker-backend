import * as admin from 'firebase-admin';
import cron from 'node-cron';
import { pool } from '../db';

export function startBillReminderCron(): void {
  // Runs daily at 09:00 AM Europe/Istanbul
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('[Cron] Running daily bill check (09:00 AM)...');
      try {
        const query = `
          SELECT 
            b.id,
            b.vendor_name AS "vendorName",
            b.amount,
            b.currency,
            b.due_date AS "dueDate",
            (b.due_date - CURRENT_DATE) AS "daysLeft",
            u.fcm_token AS "fcmToken"
          FROM bills b
          INNER JOIN users u ON b.user_id = u.id
          WHERE b.status = 'pending'
            AND u.fcm_token IS NOT NULL
            AND b.due_date IN (
              CURRENT_DATE + INTERVAL '1 day',
              CURRENT_DATE + INTERVAL '2 days',
              CURRENT_DATE + INTERVAL '3 days'
            );
        `;

        const { rows } = await pool.query(query);
        console.log(`[Cron] Found ${rows.length} bills due in 1-3 days.`);

        if (admin.apps.length > 0) {
          for (const bill of rows) {
            const message = {
              notification: {
                title: 'Fatura Hatırlatması',
                body: `${bill.vendorName} faturana ${bill.daysLeft} gün kaldı (${bill.amount} ${bill.currency}).`,
              },
              data: {
                type: 'bill_reminder',
                billId: String(bill.id),
              },
              token: bill.fcmToken,
            };

            await admin.messaging().send(message);
          }
        }
      } catch (err) {
        console.error('[Cron] Error during bill reminder check:', err);
      }
    },
    { timezone: 'Europe/Istanbul' }
  );

  console.log('[Cron] Bill reminder scheduled daily at 09:00 AM Europe/Istanbul.');
}
