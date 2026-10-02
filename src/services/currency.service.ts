import axios from 'axios';
import { pool } from '../db';
import { CurrencyRates } from '../types';

let inMemoryCache: { data: CurrencyRates; expiresAt: number } | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

const FALLBACK_RATES: CurrencyRates = {
  date: new Date().toISOString().split('T')[0],
  usdToTry: 34.25,
  eurToTry: 37.80,
  goldPerGram: 2950.0,
};

export async function getOrFetchDailyRates(): Promise<CurrencyRates> {
  const today = new Date().toISOString().split('T')[0];

  // 1. In-memory Cache check
  if (inMemoryCache && inMemoryCache.data.date === today && Date.now() < inMemoryCache.expiresAt) {
    return inMemoryCache.data;
  }

  // 2. Check Database
  try {
    const dbResult = await pool.query<CurrencyRates>(
      'SELECT date, usd_to_try as "usdToTry", eur_to_try as "eurToTry", gold_per_gram as "goldPerGram" FROM currency_rates WHERE date = $1',
      [today]
    );

    if (dbResult.rows.length > 0) {
      const rateRow = dbResult.rows[0];
      inMemoryCache = { data: rateRow, expiresAt: Date.now() + CACHE_DURATION_MS };
      return rateRow;
    }
  } catch (err) {
    console.warn('[Currency] DB lookup error:', err);
  }

  // 3. Fetch from External APIs
  let usdToTry = FALLBACK_RATES.usdToTry;
  let eurToTry = FALLBACK_RATES.eurToTry;
  let goldPerGram = FALLBACK_RATES.goldPerGram;

  try {
    const fxRes = await axios.get('https://api.exchangerate-api.com/v4/latest/TRY', { timeout: 4000 });
    const rates = fxRes.data?.rates;
    if (rates?.USD && rates?.EUR) {
      usdToTry = Number((1 / rates.USD).toFixed(2));
      eurToTry = Number((1 / rates.EUR).toFixed(2));
    }
  } catch (err: any) {
    console.warn('[Currency] FX API lookup warning:', err.message);
  }

  try {
    const goldRes = await axios.get('https://api.gold-api.com/price/XAU', { timeout: 4000 });
    if (goldRes.data?.price) {
      const ounceUsd = goldRes.data.price;
      goldPerGram = Number(((ounceUsd / 31.1034768) * usdToTry).toFixed(2));
    }
  } catch (err: any) {
    console.warn('[Currency] Gold API lookup warning:', err.message);
  }

  const rates: CurrencyRates = {
    date: today,
    usdToTry,
    eurToTry,
    goldPerGram,
  };

  // 4. Save to DB
  try {
    const insertQuery = `
      INSERT INTO currency_rates (date, usd_to_try, eur_to_try, gold_per_gram)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (date) DO UPDATE 
      SET usd_to_try = EXCLUDED.usd_to_try,
          eur_to_try = EXCLUDED.eur_to_try,
          gold_per_gram = EXCLUDED.gold_per_gram
      RETURNING date, usd_to_try as "usdToTry", eur_to_try as "eurToTry", gold_per_gram as "goldPerGram";
    `;
    const inserted = await pool.query<CurrencyRates>(insertQuery, [today, usdToTry, eurToTry, goldPerGram]);
    if (inserted.rows.length > 0) {
      inMemoryCache = { data: inserted.rows[0], expiresAt: Date.now() + CACHE_DURATION_MS };
      return inserted.rows[0];
    }
  } catch (err) {
    console.warn('[Currency] DB insert error:', err);
  }

  inMemoryCache = { data: rates, expiresAt: Date.now() + CACHE_DURATION_MS };
  return rates;
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (amount <= 0) return 0;
  if (from.toUpperCase() === to.toUpperCase()) return amount;

  const rates = await getOrFetchDailyRates();

  let amountInTRY = 0;
  switch (from.toUpperCase()) {
    case 'TRY':
      amountInTRY = amount;
      break;
    case 'USD':
      amountInTRY = amount * rates.usdToTry;
      break;
    case 'EUR':
      amountInTRY = amount * rates.eurToTry;
      break;
    case 'GOLD':
      amountInTRY = amount * rates.goldPerGram;
      break;
    default:
      amountInTRY = amount;
  }

  switch (to.toUpperCase()) {
    case 'TRY':
      return Number(amountInTRY.toFixed(2));
    case 'USD':
      return Number((amountInTRY / rates.usdToTry).toFixed(2));
    case 'EUR':
      return Number((amountInTRY / rates.eurToTry).toFixed(2));
    case 'GOLD':
      return Number((amountInTRY / rates.goldPerGram).toFixed(3));
    default:
      return Number(amountInTRY.toFixed(2));
  }
}
