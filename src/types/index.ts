import { Request } from 'express';

export type BillStatus = 'pending' | 'paid' | 'overdue';
export type TransactionType = 'income' | 'expense';
export type Currency = 'TRY' | 'USD' | 'EUR';

export interface User {
  id: string;
  name: string;
  email: string;
  fcmToken?: string;
}

export interface Bill {
  id: string;
  userId: string;
  title?: string;
  vendorName: string;
  vendorCategory?: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  status: BillStatus;
  recurrenceInterval?: string;
  invoicePdfUrl?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  billId?: string;
  budgetId?: number;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category: string;
  date: string;
  description?: string;
}

export interface Budget {
  id: number;
  userId: string;
  category: string;
  limitAmount: number;
  currency: string;
  startDate: string;
  endDate: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  targetCurrency: string;
  currentAmount: number;
  startDate: string;
}

export interface CurrencyRates {
  date: string;
  usdToTry: number;
  eurToTry: number;
  goldPerGram: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}
