import { CurrencyCode, ExpenseItem, IncomeItem, InvoiceItem } from '../types/business';

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF ', decimals: 2 },
];

export const CURRENCY_MAP: Record<CurrencyCode, CurrencyMeta> = SUPPORTED_CURRENCIES.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<CurrencyCode, CurrencyMeta>
);

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCY_MAP[currency] ?? { code: currency, symbol: `${currency} `, decimals: 2 };
  const absFormatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return amount < 0 ? `-${meta.symbol}${absFormatted}` : `${meta.symbol}${absFormatted}`;
}

export interface CurrencyGroupTotal {
  currency: CurrencyCode;
  total: number;
  count: number;
}

/**
 * Strictly groups monetary amounts by original currency.
 * Never blindly sums values across different currencies.
 */
export function groupAmountsByCurrency<T extends { currency: CurrencyCode }>(
  items: T[],
  getAmount: (item: T) => number
): CurrencyGroupTotal[] {
  const map = new Map<CurrencyCode, { total: number; count: number }>();
  for (const item of items) {
    const val = getAmount(item);
    const existing = map.get(item.currency) ?? { total: 0, count: 0 };
    map.set(item.currency, {
      total: existing.total + val,
      count: existing.count + 1,
    });
  }
  return Array.from(map.entries())
    .map(([currency, data]) => ({
      currency,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getInvoiceSubtotal(invoice: InvoiceItem): number {
  return invoice.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
}

export function getInvoiceTotal(invoice: InvoiceItem): number {
  const subtotal = getInvoiceSubtotal(invoice);
  return subtotal + subtotal * (invoice.taxRate / 100);
}

/**
 * Calculates verified paid amount for an invoice from linked Income records
 * plus explicitly recorded payment info, ensuring we never claim an invoice is
 * paid unless underlying payment records confirm it.
 */
export function getInvoicePaidAmount(invoice: InvoiceItem, incomes: IncomeItem[]): number {
  const linkedIncomeTotal = incomes
    .filter((inc) => inc.invoiceId === invoice.id && inc.currency === invoice.currency && inc.verified)
    .reduce((sum, inc) => sum + inc.amount, 0);
  if (linkedIncomeTotal > 0) {
    return linkedIncomeTotal;
  }
  return invoice.paymentConfirmed ? invoice.paidAmountRecorded : 0;
}

export function getInvoiceComputedStatus(
  invoice: InvoiceItem,
  incomes: IncomeItem[],
  referenceDateISO: string
): 'Draft' | 'Sent' | 'Partially Paid' | 'Paid' | 'Overdue' {
  const total = getInvoiceTotal(invoice);
  const paid = getInvoicePaidAmount(invoice, incomes);

  if (total > 0 && paid >= total - 0.01) {
    return 'Paid';
  }
  if (paid > 0 && paid < total) {
    return 'Partially Paid';
  }
  if (!invoice.paymentConfirmed && invoice.paymentRecordNotes.toLowerCase().includes('draft')) {
    return 'Draft';
  }
  if (invoice.dueDate && invoice.dueDate < referenceDateISO) {
    return 'Overdue';
  }
  return 'Sent';
}

export interface ProjectFinancialSummary {
  currency: CurrencyCode;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

/**
 * Preserves Notion Projects rollup/formula logic:
 * Total Income (rollup of related Income), Total Expenses (rollup of related Expenses),
 * Net Profit = Total Income - Total Expenses, grouped safely per currency.
 */
export function computeProjectFinancials(
  projectId: string,
  incomes: IncomeItem[],
  expenses: ExpenseItem[]
): ProjectFinancialSummary[] {
  const relatedIncomes = incomes.filter((i) => i.projectId === projectId);
  const relatedExpenses = expenses.filter((e) => e.projectId === projectId);

  const currencies = new Set<CurrencyCode>();
  relatedIncomes.forEach((i) => currencies.add(i.currency));
  relatedExpenses.forEach((e) => currencies.add(e.currency));

  return Array.from(currencies).map((currency) => {
    const totalIncome = relatedIncomes
      .filter((i) => i.currency === currency)
      .reduce((s, i) => s + i.amount, 0);
    const totalExpenses = relatedExpenses
      .filter((e) => e.currency === currency)
      .reduce((s, e) => s + e.amount, 0);
    return {
      currency,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
    };
  });
}
