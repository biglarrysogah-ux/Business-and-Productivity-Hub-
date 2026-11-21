import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Printer } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { formatCurrency, groupAmountsByCurrency } from '../lib/currencies';
import { formatMinutesToHours, getPeriodDateRange, isDateInRange, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';
import { CurrencyCode } from '../types/business';

export function AnalyticsPage() {
  const { dataset, reportingPeriod, currencyFilter, settings } = useHub();
  const activeCurrency: CurrencyCode =
    currencyFilter === 'ALL' ? settings.business.defaultCurrency : currencyFilter;
  const periodRange = useMemo(() => getPeriodDateRange(reportingPeriod, REFERENCE_TODAY), [reportingPeriod]);

  const filteredIncomes = useMemo(
    () => dataset.incomes.filter((i) => isDateInRange(i.date, periodRange.start, periodRange.end)),
    [dataset.incomes, periodRange]
  );
  const filteredExpenses = useMemo(
    () => dataset.expenses.filter((e) => isDateInRange(e.date, periodRange.start, periodRange.end)),
    [dataset.expenses, periodRange]
  );

  const incomeByCurrency = useMemo(() => groupAmountsByCurrency(filteredIncomes, (i) => i.amount), [filteredIncomes]);
  const expenseByCurrency = useMemo(() => groupAmountsByCurrency(filteredExpenses, (e) => e.amount), [filteredExpenses]);

  const allCurrencies = useMemo(() => {
    const s = new Set<CurrencyCode>([
      ...incomeByCurrency.map((g) => g.currency),
      ...expenseByCurrency.map((g) => g.currency),
    ]);
    return Array.from(s);
  }, [incomeByCurrency, expenseByCurrency]);

  const monthlyComparison = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = Array.from(
      new Set([
        ...dataset.incomes.filter((i) => i.currency === activeCurrency).map((i) => i.date.slice(0, 7)),
        ...dataset.expenses.filter((e) => e.currency === activeCurrency).map((e) => e.date.slice(0, 7)),
      ])
    ).sort();

    return months.map((m) => {
      const income = dataset.incomes
        .filter((i) => i.currency === activeCurrency && i.date.startsWith(m))
        .reduce((s, i) => s + i.amount, 0);
      const expenses = dataset.expenses
        .filter((e) => e.currency === activeCurrency && e.date.startsWith(m))
        .reduce((s, e) => s + e.amount, 0);
      const mIdx = Number(m.split('-')[1]) - 1;
      const label = monthNames[mIdx] ? `${monthNames[mIdx]} ${m.slice(2, 4)}` : m;
      return {
        month: label,
        income,
        expenses,
        profit: income - expenses,
      };
    });
  }, [dataset.incomes, dataset.expenses, activeCurrency]);

  const timeSummary = useMemo(() => {
    const totalMinutes = dataset.timeEntries.reduce((s, t) => s + t.durationMinutes, 0);
    const billableMinutes = dataset.timeEntries.filter((t) => t.billable).reduce((s, t) => s + t.durationMinutes, 0);
    const nonBillableMinutes = totalMinutes - billableMinutes;
    const utilization = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0;
    const earningsByCurrency = groupAmountsByCurrency(
      dataset.timeEntries.filter((t) => t.billable),
      (t) => (t.durationMinutes / 60) * t.hourlyRate
    );
    return { totalMinutes, billableMinutes, nonBillableMinutes, utilization, earningsByCurrency };
  }, [dataset.timeEntries]);

  const proposalStats = useMemo(() => {
    const total = dataset.proposals.length;
    const accepted = dataset.proposals.filter((p) => p.status === 'Accepted').length;
    const active = dataset.proposals.filter((p) => p.status === 'Sent' || p.status === 'Under Review' || p.status === 'Follow-up Due').length;
    const winRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    return { total, accepted, active, winRate };
  }, [dataset.proposals]);

  const handleExportSummary = () => {
    const rows = allCurrencies.map((cur) => {
      const inc = incomeByCurrency.find((g) => g.currency === cur)?.total ?? 0;
      const exp = expenseByCurrency.find((g) => g.currency === cur)?.total ?? 0;
      return [cur, inc.toFixed(2), exp.toFixed(2), (inc - exp).toFixed(2), periodRange.label];
    });
    downloadCSV(
      `business-hub-analytics-${periodRange.label.toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Currency', 'Total Income', 'Total Expenses', 'Net Profit', 'Reporting Period'],
      rows
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#263247]">Business Analytics</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Multi-currency financial summary, monthly profit trends, time utilization, and proposal pipeline ({periodRange.label}).
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#263247] bg-white border border-[#E7E9F1] hover:bg-[#F4F5FC] rounded-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Multi-currency summary table (never blindly sums currencies) */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold text-[#263247]">
            Currency-Isolated Profit &amp; Loss ({periodRange.label})
          </h3>
          <p className="text-xs text-[#8A91A3] mt-0.5">
            Transactions are grouped strictly by original currency. Net Profit = Total Income minus Total Expenses.
          </p>
        </div>
        {allCurrencies.length === 0 ? (
          <p className="text-sm text-[#8A91A3] py-6 text-center">No financial records found in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E9F1] text-xs font-semibold text-[#8A91A3]">
                  <th className="py-2.5 pr-4">Currency</th>
                  <th className="py-2.5 px-4 text-right">Total Income</th>
                  <th className="py-2.5 px-4 text-right">Total Expenses</th>
                  <th className="py-2.5 pl-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9F1] text-sm">
                {allCurrencies.map((cur) => {
                  const inc = incomeByCurrency.find((g) => g.currency === cur)?.total ?? 0;
                  const exp = expenseByCurrency.find((g) => g.currency === cur)?.total ?? 0;
                  const net = inc - exp;
                  return (
                    <tr key={cur}>
                      <td className="py-3 pr-4 font-semibold text-[#263247]">{cur}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#263247]">{formatCurrency(inc, cur)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#4E596F]">{formatCurrency(exp, cur)}</td>
                      <td className={`py-3 pl-4 text-right font-semibold tabular-nums ${net >= 0 ? 'text-[#2DAA82]' : 'text-[#DC2626]'}`}>
                        {formatCurrency(net, cur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Income vs Expenses Monthly Chart */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold text-[#263247]">
            Monthly Income, Expenses &amp; Net Profit ({activeCurrency})
          </h3>
          <p className="text-xs text-[#8A91A3]">Comparison of monthly cashflow in {activeCurrency}</p>
        </div>
        {monthlyComparison.length === 0 ? (
          <p className="text-sm text-[#8A91A3] py-12 text-center">
            No {activeCurrency} financial transactions available yet. Connect your Notion workspace or record transactions to view monthly trends.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E9F1" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#8A91A3', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A91A3', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val) => formatCurrency(Number(val ?? 0), activeCurrency)}
                  contentStyle={{ borderRadius: '10px', borderColor: '#E7E9F1', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name="Income" fill="#7853E8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#39B5B6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Net Profit" fill="#2DAA82" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Time Utilization & Proposal Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
          <h3 className="font-display text-base font-semibold text-[#263247] mb-4">Time &amp; Billable Utilization</h3>
          {dataset.timeEntries.length === 0 ? (
            <p className="text-sm text-[#8A91A3] py-6">No time entries logged yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-[#F4F5FC]">
                  <p className="text-xs text-[#8A91A3]">Logged Time</p>
                  <p className="text-lg font-bold text-[#263247] tabular-nums mt-0.5">
                    {formatMinutesToHours(timeSummary.totalMinutes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#39B5B6]/10">
                  <p className="text-xs text-[#8A91A3]">Billable</p>
                  <p className="text-lg font-bold text-[#1E8283] tabular-nums mt-0.5">
                    {formatMinutesToHours(timeSummary.billableMinutes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#7853E8]/10">
                  <p className="text-xs text-[#8A91A3]">Utilization</p>
                  <p className="text-lg font-bold text-[#7853E8] tabular-nums mt-0.5">{timeSummary.utilization}%</p>
                </div>
              </div>
              <div className="border-t border-[#E7E9F1] pt-3">
                <p className="text-xs font-semibold text-[#8A91A3] mb-2">Estimated Billable Earnings by Currency</p>
                {timeSummary.earningsByCurrency.length === 0 ? (
                  <p className="text-xs text-[#8A91A3]">No billable time logged yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {timeSummary.earningsByCurrency.map((g) => (
                      <span key={g.currency} className="text-sm font-semibold text-[#263247] tabular-nums">
                        {formatCurrency(g.total, g.currency)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
          <h3 className="font-display text-base font-semibold text-[#263247] mb-4">Proposal Pipeline Performance</h3>
          {proposalStats.total === 0 ? (
            <p className="text-sm text-[#8A91A3] py-6">No proposals yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-[#F4F5FC]">
                  <p className="text-xs text-[#8A91A3]">Total Proposals</p>
                  <p className="text-lg font-bold text-[#263247] tabular-nums mt-0.5">{proposalStats.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#78A7E8]/15">
                  <p className="text-xs text-[#8A91A3]">Active Review</p>
                  <p className="text-lg font-bold text-[#2E5FA3] tabular-nums mt-0.5">{proposalStats.active}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#2DAA82]/10">
                  <p className="text-xs text-[#8A91A3]">Acceptance Rate</p>
                  <p className="text-lg font-bold text-[#2DAA82] tabular-nums mt-0.5">{proposalStats.winRate}%</p>
                </div>
              </div>
              <div className="border-t border-[#E7E9F1] pt-3">
                <p className="text-xs text-[#8A91A3]">
                  {proposalStats.accepted} accepted out of {proposalStats.total} tracked proposals.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
