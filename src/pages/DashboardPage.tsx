import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckSquare,
  Clock,
  DollarSign,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Plus,
  Receipt,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Database,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import {
  formatCurrency,
  getInvoiceComputedStatus,
  getInvoicePaidAmount,
  getInvoiceTotal,
  groupAmountsByCurrency,
  SUPPORTED_CURRENCIES,
} from '../lib/currencies';
import {
  formatDisplayDate,
  getPeriodDateRange,
  isDateInRange,
  REFERENCE_TODAY,
} from '../lib/dateUtils';
import { CurrencyCode, NavRoute, ReportingPeriod } from '../types/business';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';

const CHART_COLORS = ['#7853E8', '#39B5B6', '#78A7E8', '#E9AD58', '#2DAA82', '#9F85F0'];

function calcDeltaPct(current: number, previous: number): { label: string; positive: boolean; neutral: boolean } | null {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return {
    label: `${rounded > 0 ? '+' : ''}${rounded}% vs prior period`,
    positive: rounded >= 0,
    neutral: rounded === 0,
  };
}

export function DashboardPage() {
  const {
    dataset,
    reportingPeriod,
    setReportingPeriod,
    currencyFilter,
    setCurrencyFilter,
    settings,
    updateFinancialTargets,
    openQuickCreate,
    navigateToRecord,
    setRoute,
  } = useHub();

  const [breakdownMode, setBreakdownMode] = useState<'income' | 'expenses'>('income');
  const [targetModalOpen, setTargetModalOpen] = useState(false);

  const activeCurrency: CurrencyCode =
    currencyFilter === 'ALL' ? settings.business.defaultCurrency : currencyFilter;

  const currentTarget = settings.targetsByCurrency[activeCurrency] ?? {
    currency: activeCurrency,
    incomeTarget: 0,
    expenseBudget: 0,
    profitTarget: 0,
  };

  const [draftTarget, setDraftTarget] = useState(currentTarget);

  const openTargetEditor = () => {
    setDraftTarget(
      settings.targetsByCurrency[activeCurrency] ?? {
        currency: activeCurrency,
        incomeTarget: 0,
        expenseBudget: 0,
        profitTarget: 0,
      }
    );
    setTargetModalOpen(true);
  };

  const periodRange = useMemo(() => getPeriodDateRange(reportingPeriod, REFERENCE_TODAY), [reportingPeriod]);

  // Filter incomes and expenses by reporting period and currency filter
  const periodIncomes = useMemo(
    () =>
      dataset.incomes.filter(
        (i) =>
          isDateInRange(i.date, periodRange.start, periodRange.end) &&
          (currencyFilter === 'ALL' || i.currency === currencyFilter)
      ),
    [dataset.incomes, periodRange, currencyFilter]
  );

  const prevPeriodIncomes = useMemo(() => {
    if (!periodRange.prevStart || !periodRange.prevEnd) return [];
    return dataset.incomes.filter(
      (i) =>
        isDateInRange(i.date, periodRange.prevStart, periodRange.prevEnd) &&
        (currencyFilter === 'ALL' || i.currency === currencyFilter)
    );
  }, [dataset.incomes, periodRange, currencyFilter]);

  const periodExpenses = useMemo(
    () =>
      dataset.expenses.filter(
        (e) =>
          isDateInRange(e.date, periodRange.start, periodRange.end) &&
          (currencyFilter === 'ALL' || e.currency === currencyFilter)
      ),
    [dataset.expenses, periodRange, currencyFilter]
  );

  const prevPeriodExpenses = useMemo(() => {
    if (!periodRange.prevStart || !periodRange.prevEnd) return [];
    return dataset.expenses.filter(
      (e) =>
        isDateInRange(e.date, periodRange.prevStart, periodRange.prevEnd) &&
        (currencyFilter === 'ALL' || e.currency === currencyFilter)
    );
  }, [dataset.expenses, periodRange, currencyFilter]);

  // Currency-safe grouped totals (never blindly sum different currencies)
  const incomeGroups = useMemo(() => groupAmountsByCurrency(periodIncomes, (i) => i.amount), [periodIncomes]);
  const expenseGroups = useMemo(() => groupAmountsByCurrency(periodExpenses, (e) => e.amount), [periodExpenses]);

  const activeCurrencyIncome = useMemo(
    () => periodIncomes.filter((i) => i.currency === activeCurrency).reduce((s, i) => s + i.amount, 0),
    [periodIncomes, activeCurrency]
  );
  const prevActiveCurrencyIncome = useMemo(
    () => prevPeriodIncomes.filter((i) => i.currency === activeCurrency).reduce((s, i) => s + i.amount, 0),
    [prevPeriodIncomes, activeCurrency]
  );

  const activeCurrencyExpenses = useMemo(
    () => periodExpenses.filter((e) => e.currency === activeCurrency).reduce((s, e) => s + e.amount, 0),
    [periodExpenses, activeCurrency]
  );
  const prevActiveCurrencyExpenses = useMemo(
    () => prevPeriodExpenses.filter((e) => e.currency === activeCurrency).reduce((s, e) => s + e.amount, 0),
    [prevPeriodExpenses, activeCurrency]
  );

  const activeCurrencyProfit = activeCurrencyIncome - activeCurrencyExpenses;
  const prevActiveCurrencyProfit = prevActiveCurrencyIncome - prevActiveCurrencyExpenses;

  const profitGroups = useMemo(() => {
    const currencies = new Set<CurrencyCode>([
      ...incomeGroups.map((g) => g.currency),
      ...expenseGroups.map((g) => g.currency),
    ]);
    return Array.from(currencies).map((cur) => {
      const inc = incomeGroups.find((g) => g.currency === cur)?.total ?? 0;
      const exp = expenseGroups.find((g) => g.currency === cur)?.total ?? 0;
      return { currency: cur, total: inc - exp };
    });
  }, [incomeGroups, expenseGroups]);

  // Outstanding invoices
  const invoiceStats = useMemo(() => {
    const filtered = dataset.invoices.filter(
      (inv) => currencyFilter === 'ALL' || inv.currency === currencyFilter
    );
    const unpaidItems: { currency: CurrencyCode; balance: number; overdue: boolean }[] = [];
    filtered.forEach((inv) => {
      const total = getInvoiceTotal(inv);
      const paid = getInvoicePaidAmount(inv, dataset.incomes);
      const balance = Math.max(0, total - paid);
      const status = getInvoiceComputedStatus(inv, dataset.incomes, REFERENCE_TODAY);
      if (balance > 0.01 && status !== 'Draft') {
        unpaidItems.push({ currency: inv.currency, balance, overdue: status === 'Overdue' });
      }
    });
    const byCurrency = groupAmountsByCurrency(unpaidItems, (u) => u.balance);
    return {
      unpaidCount: unpaidItems.length,
      overdueCount: unpaidItems.filter((u) => u.overdue).length,
      byCurrency,
    };
  }, [dataset.invoices, dataset.incomes, currencyFilter]);

  const incomeDelta = calcDeltaPct(activeCurrencyIncome, prevActiveCurrencyIncome);
  const expenseDelta = calcDeltaPct(activeCurrencyExpenses, prevActiveCurrencyExpenses);
  const profitDelta =
    prevActiveCurrencyIncome > 0 || prevActiveCurrencyExpenses > 0
      ? calcDeltaPct(activeCurrencyProfit, prevActiveCurrencyProfit)
      : null;

  // Monthly Revenue Trend chart data for activeCurrency
  const revenueTrendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const map = new Map<string, { monthKey: string; label: string; income: number; expenses: number }>();

    const allDates = [
      ...dataset.incomes.filter((i) => i.currency === activeCurrency).map((i) => i.date),
      ...dataset.expenses.filter((e) => e.currency === activeCurrency).map((e) => e.date),
    ].sort();

    if (allDates.length === 0) return [];

    dataset.incomes
      .filter((i) => i.currency === activeCurrency)
      .forEach((i) => {
        const ym = i.date.slice(0, 7);
        if (!map.has(ym)) {
          const mIdx = Number(ym.split('-')[1]) - 1;
          map.set(ym, { monthKey: ym, label: `${monthNames[mIdx]} ${ym.slice(2, 4)}`, income: 0, expenses: 0 });
        }
        map.get(ym)!.income += i.amount;
      });

    dataset.expenses
      .filter((e) => e.currency === activeCurrency)
      .forEach((e) => {
        const ym = e.date.slice(0, 7);
        if (!map.has(ym)) {
          const mIdx = Number(ym.split('-')[1]) - 1;
          map.set(ym, { monthKey: ym, label: `${monthNames[mIdx]} ${ym.slice(2, 4)}`, income: 0, expenses: 0 });
        }
        map.get(ym)!.expenses += e.amount;
      });

    return Array.from(map.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((row, idx, arr) => ({
        ...row,
        priorMonthIncome: idx > 0 ? arr[idx - 1].income : null,
      }));
  }, [dataset.incomes, dataset.expenses, activeCurrency]);

  // Financial Breakdown (only actual categories present in activeCurrency data)
  const breakdownData = useMemo(() => {
    const map = new Map<string, number>();
    if (breakdownMode === 'income') {
      periodIncomes
        .filter((i) => i.currency === activeCurrency)
        .forEach((i) => {
          map.set(i.category, (map.get(i.category) ?? 0) + i.amount);
        });
    } else {
      periodExpenses
        .filter((e) => e.currency === activeCurrency)
        .forEach((e) => {
          map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
        });
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [periodIncomes, periodExpenses, breakdownMode, activeCurrency]);

  // Project Overview stats
  const projectStats = useMemo(() => {
    const total = dataset.projects.length;
    const notStarted = dataset.projects.filter((p) => p.status === 'Not Started').length;
    const inProgress = dataset.projects.filter((p) => p.status === 'In Progress').length;
    const completed = dataset.projects.filter((p) => p.status === 'Completed').length;
    const onHold = dataset.projects.filter((p) => p.status === 'On Hold').length;
    return {
      total,
      notStarted,
      inProgress,
      completed,
      onHold,
      chart: [
        { name: 'Not Started', count: notStarted, fill: '#78A7E8' },
        { name: 'In Progress', count: inProgress, fill: '#7853E8' },
        { name: 'Completed', count: completed, fill: '#2DAA82' },
        ...(onHold > 0 ? [{ name: 'On Hold', count: onHold, fill: '#E9AD58' }] : []),
      ],
    };
  }, [dataset.projects]);

  // Task Overview stats
  const taskStats = useMemo(() => {
    const total = dataset.tasks.length;
    const pending = dataset.tasks.filter((t) => t.status === 'Not Started' || t.status === 'Waiting').length;
    const inProgress = dataset.tasks.filter((t) => t.status === 'In Progress').length;
    const completed = dataset.tasks.filter((t) => t.status === 'Completed').length;
    const overdue = dataset.tasks.filter(
      (t) => t.status !== 'Completed' && t.dueDate && t.dueDate < REFERENCE_TODAY
    ).length;
    return { total, pending, inProgress, completed, overdue };
  }, [dataset.tasks]);

  // Recent Activity across all 8 modules
  const recentActivity = useMemo(() => {
    type ActivityRow = {
      id: string;
      title: string;
      module: string;
      route: NavRoute;
      timestamp: string;
      detail: string;
    };
    const items: ActivityRow[] = [];
    dataset.clients.forEach((c) =>
      items.push({ id: c.id, title: c.company || c.name, module: 'Client', route: 'clients', timestamp: c.updatedAt, detail: `${c.name} · ${c.status}` })
    );
    dataset.projects.forEach((p) =>
      items.push({ id: p.id, title: p.name, module: 'Project', route: 'projects', timestamp: p.updatedAt, detail: `${p.status} · ${p.progress}%` })
    );
    dataset.tasks.forEach((t) =>
      items.push({ id: t.id, title: t.title, module: 'Task', route: 'tasks', timestamp: t.updatedAt, detail: `${t.status} · ${t.priority}` })
    );
    dataset.invoices.forEach((inv) =>
      items.push({
        id: inv.id,
        title: `Invoice ${inv.invoiceNumber}`,
        module: 'Invoice',
        route: 'invoices',
        timestamp: inv.updatedAt,
        detail: `${formatCurrency(getInvoiceTotal(inv), inv.currency)} · Due ${inv.dueDate}`,
      })
    );
    dataset.incomes.forEach((inc) =>
      items.push({
        id: inc.id,
        title: inc.title,
        module: 'Income',
        route: 'income',
        timestamp: inc.updatedAt,
        detail: `${formatCurrency(inc.amount, inc.currency)} · ${inc.paymentMethod}`,
      })
    );
    dataset.expenses.forEach((exp) =>
      items.push({
        id: exp.id,
        title: exp.title,
        module: 'Expense',
        route: 'expenses',
        timestamp: exp.updatedAt,
        detail: `${formatCurrency(exp.amount, exp.currency)} · ${exp.vendor}`,
      })
    );
    dataset.proposals.forEach((pr) =>
      items.push({
        id: pr.id,
        title: pr.title,
        module: 'Proposal',
        route: 'proposals',
        timestamp: pr.updatedAt,
        detail: `${pr.status} · ${formatCurrency(pr.proposedAmount, pr.currency)}`,
      })
    );
    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8);
  }, [dataset]);

  const hasAnyRecords =
    dataset.clients.length +
      dataset.projects.length +
      dataset.tasks.length +
      dataset.invoices.length +
      dataset.incomes.length +
      dataset.expenses.length +
      dataset.timeEntries.length +
      dataset.proposals.length >
    0;

  const quickActions: { label: string; target: Parameters<typeof openQuickCreate>[0]; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'Add Task', target: 'task', icon: CheckSquare },
    { label: 'Add Project', target: 'project', icon: FolderKanban },
    { label: 'Add Client', target: 'client', icon: Users },
    { label: 'Create Invoice', target: 'invoice', icon: FileText },
    { label: 'Record Income', target: 'income', icon: TrendingUp },
    { label: 'Add Expense', target: 'expense', icon: Receipt },
    { label: 'Log Time', target: 'time', icon: Clock },
    { label: 'Create Proposal', target: 'proposal', icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Mobile Period/Currency Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#263247] tracking-tight">
            Business Overview
          </h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Revenue, projects, clients, productivity, and business performance at a glance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Dashboard reporting period"
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value as ReportingPeriod)}
            className="sm:hidden px-3 py-2 text-xs font-medium bg-white border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_quarter">This Quarter</option>
            <option value="year_to_date">Year to Date</option>
            <option value="all_time">All Time</option>
          </select>

          <select
            aria-label="Dashboard primary currency view"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value as CurrencyCode | 'ALL')}
            className="xl:hidden px-3 py-2 text-xs font-medium bg-white border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="ALL">All Currencies (Grouped)</option>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol.trim()})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => openQuickCreate('invoice')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#8A91A3] tracking-wide">Quick Actions</h3>
          <span className="text-xs text-[#8A91A3]">Create records across all 8 modules</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.label}
                type="button"
                onClick={() => openQuickCreate(qa.target)}
                className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2.5 rounded-lg border border-[#E7E9F1] bg-[#F8F9FD] hover:bg-[#7853E8] hover:text-white hover:border-[#7853E8] text-xs font-medium text-[#263247] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{qa.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!hasAnyRecords ? (
        <div className="space-y-6">
          <div className="bg-white border border-[#E7E9F1] rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#7853E8]/10 text-[#7853E8] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[#263247]">
                  Connect your Notion workspace to get started.
                </h3>
                <p className="text-sm text-[#8A91A3] mt-1 max-w-2xl leading-relaxed">
                  Your dashboard displays real metrics from your eight connected Notion databases (Tasks, Projects, Clients, Invoices, Income, Expenses, Time Tracking, and Proposals). Connect Notion in Settings or add your first record using Quick Actions.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setRoute('help')}
                className="px-4 py-2 text-xs font-semibold text-[#263247] bg-[#F4F5FC] hover:bg-[#E7E9F1] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                User Guide
              </button>
              <button
                type="button"
                onClick={() => setRoute('settings')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Connect Notion
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { title: 'Total Income', sub: 'No income recorded yet.' },
              { title: 'Total Expenses', sub: 'No expenses recorded yet.' },
              { title: 'Net Profit', sub: 'Income minus expenses.' },
              { title: 'Outstanding Invoices', sub: 'No invoices available.' },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-[#E7E9F1] rounded-xl p-5 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
                <p className="text-xs font-semibold text-[#8A91A3]">{card.title}</p>
                <p className="font-display text-2xl font-bold text-[#8A91A3] mt-1.5 tabular-nums">—</p>
                <p className="text-xs text-[#8A91A3] mt-3 pt-3 border-t border-[#E7E9F1]">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
              <h3 className="font-display text-base font-semibold text-[#263247]">Project Overview</h3>
              <p className="text-xs text-[#8A91A3] mt-4">No projects yet.</p>
            </div>
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
              <h3 className="font-display text-base font-semibold text-[#263247]">Task Overview</h3>
              <p className="text-xs text-[#8A91A3] mt-4">No tasks yet.</p>
            </div>
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
              <h3 className="font-display text-base font-semibold text-[#263247]">Recent Activity</h3>
              <p className="text-xs text-[#8A91A3] mt-4">No recent activity yet.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* CARD 1: TOTAL INCOME */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#8A91A3]">Total Income ({activeCurrency})</p>
                  <p className="font-display text-2xl font-bold text-[#263247] mt-1.5 tabular-nums">
                    {formatCurrency(activeCurrencyIncome, activeCurrency)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#7853E8]/10 text-[#7853E8] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E9F1] flex items-center justify-between gap-2 text-xs">
                {incomeDelta ? (
                  <span className={`inline-flex items-center gap-1 font-medium ${incomeDelta.positive ? 'text-[#2DAA82]' : 'text-[#DC2626]'}`}>
                    {incomeDelta.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {incomeDelta.label}
                  </span>
                ) : (
                  <span className="text-[#8A91A3]">{periodRange.label}</span>
                )}
                {currencyFilter === 'ALL' && incomeGroups.filter((g) => g.currency !== activeCurrency).length > 0 && (
                  <span className="text-[#8A91A3] tabular-nums truncate">
                    + {incomeGroups.filter((g) => g.currency !== activeCurrency).map((g) => formatCurrency(g.total, g.currency)).join(' · ')}
                  </span>
                )}
              </div>
            </div>

            {/* CARD 2: TOTAL EXPENSES */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#8A91A3]">Total Expenses ({activeCurrency})</p>
                  <p className="font-display text-2xl font-bold text-[#263247] mt-1.5 tabular-nums">
                    {formatCurrency(activeCurrencyExpenses, activeCurrency)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#39B5B6]/12 text-[#39B5B6] flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E9F1] flex items-center justify-between gap-2 text-xs">
                {expenseDelta ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[#4E596F]">
                    {expenseDelta.label}
                  </span>
                ) : (
                  <span className="text-[#8A91A3]">{periodRange.label}</span>
                )}
                {currencyFilter === 'ALL' && expenseGroups.filter((g) => g.currency !== activeCurrency).length > 0 && (
                  <span className="text-[#8A91A3] tabular-nums truncate">
                    + {expenseGroups.filter((g) => g.currency !== activeCurrency).map((g) => formatCurrency(g.total, g.currency)).join(' · ')}
                  </span>
                )}
              </div>
            </div>

            {/* CARD 3: NET PROFIT */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#8A91A3]">Net Profit ({activeCurrency})</p>
                  <p className={`font-display text-2xl font-bold mt-1.5 tabular-nums ${activeCurrencyProfit >= 0 ? 'text-[#263247]' : 'text-[#DC2626]'}`}>
                    {formatCurrency(activeCurrencyProfit, activeCurrency)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#2DAA82]/12 text-[#2DAA82] flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E9F1] flex items-center justify-between gap-2 text-xs">
                {profitDelta ? (
                  <span className={`inline-flex items-center gap-1 font-medium ${profitDelta.positive ? 'text-[#2DAA82]' : 'text-[#DC2626]'}`}>
                    {profitDelta.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {profitDelta.label}
                  </span>
                ) : (
                  <span className="text-[#8A91A3]">Income minus Expenses</span>
                )}
                {currencyFilter === 'ALL' && profitGroups.filter((g) => g.currency !== activeCurrency).length > 0 && (
                  <span className="text-[#8A91A3] tabular-nums truncate">
                    {profitGroups.filter((g) => g.currency !== activeCurrency).map((g) => formatCurrency(g.total, g.currency)).join(' · ')}
                  </span>
                )}
              </div>
            </div>

            {/* CARD 4: OUTSTANDING INVOICES */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#8A91A3]">Outstanding Invoices</p>
                  <p className="font-display text-2xl font-bold text-[#263247] mt-1.5 tabular-nums">
                    {dataset.invoices.length === 0
                      ? '—'
                      : invoiceStats.byCurrency.length === 0
                      ? formatCurrency(0, activeCurrency)
                      : formatCurrency(
                          invoiceStats.byCurrency.find((g) => g.currency === activeCurrency)?.total ??
                            invoiceStats.byCurrency[0].total,
                          invoiceStats.byCurrency.find((g) => g.currency === activeCurrency)?.currency ??
                            invoiceStats.byCurrency[0].currency
                        )}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#E9AD58]/15 text-[#B97719] flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E7E9F1] flex items-center justify-between gap-2 text-xs">
                {dataset.invoices.length === 0 ? (
                  <span className="text-[#8A91A3]">No invoices available.</span>
                ) : (
                  <span className="text-[#4E596F] font-medium tabular-nums">
                    {invoiceStats.unpaidCount} unpaid ·{' '}
                    <span className={invoiceStats.overdueCount > 0 ? 'text-[#DC2626] font-semibold' : ''}>
                      {invoiceStats.overdueCount} overdue
                    </span>
                  </span>
                )}
                {invoiceStats.byCurrency.filter((g) => g.currency !== activeCurrency).length > 0 && (
                  <span className="text-[#8A91A3] tabular-nums truncate">
                    + {invoiceStats.byCurrency.filter((g) => g.currency !== activeCurrency).map((g) => formatCurrency(g.total, g.currency)).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary Charts Row: Revenue Trend (8 cols) + Financial Breakdown (4 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Revenue Trend */}
            <div className="xl:col-span-8 bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#263247]">Revenue Trend</h3>
                  <p className="text-xs text-[#8A91A3]">
                    Monthly recorded income vs expenses in {activeCurrency}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#4E596F]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7853E8]" />
                    Income
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#39B5B6]" />
                    Expenses
                  </span>
                </div>
              </div>

              {revenueTrendData.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-[#8A91A3]">
                  No {activeCurrency} transactions recorded yet for trend visualization.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomePurpleGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7853E8" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#7853E8" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E9F1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#8A91A3', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: '#8A91A3', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E7E9F1',
                          borderRadius: '10px',
                          fontSize: '12px',
                        }}
                        formatter={(value, name) => [
                          formatCurrency(Number(value ?? 0), activeCurrency),
                          name === 'income' ? 'Income' : 'Expenses',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#7853E8"
                        strokeWidth={2.5}
                        fill="url(#incomePurpleGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#39B5B6"
                        strokeWidth={2}
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Financial Breakdown */}
            <div className="xl:col-span-4 bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#263247]">Financial Breakdown</h3>
                  <p className="text-xs text-[#8A91A3]">By recorded {activeCurrency} category</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-[#F4F5FC] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('income')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      breakdownMode === 'income' ? 'bg-white text-[#263247] shadow-sm' : 'text-[#8A91A3]'
                    }`}
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('expenses')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      breakdownMode === 'expenses' ? 'bg-white text-[#263247] shadow-sm' : 'text-[#8A91A3]'
                    }`}
                  >
                    Expenses
                  </button>
                </div>
              </div>

              {breakdownData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-[#8A91A3] py-12 text-center">
                  No {breakdownMode} categories recorded in {activeCurrency} for {periodRange.label}.
                </div>
              ) : (
                <>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdownData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={76}
                          paddingAngle={3}
                        >
                          {breakdownData.map((entry, idx) => (
                            <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val) => formatCurrency(Number(val ?? 0), activeCurrency)}
                          contentStyle={{ borderRadius: '10px', borderColor: '#E7E9F1', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 space-y-2">
                    {breakdownData.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-[#4E596F] truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-semibold text-[#263247] tabular-nums shrink-0">
                          {formatCurrency(item.value, activeCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Operational Row: Project Overview + Task Overview + Financial Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project Overview */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#263247]">Project Overview</h3>
                  <p className="text-xs text-[#8A91A3] tabular-nums">{projectStats.total} total projects</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoute('projects')}
                  className="text-xs font-semibold text-[#7853E8] hover:underline cursor-pointer"
                >
                  View all
                </button>
              </div>

              {projectStats.total === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-[#8A91A3] py-10">
                  No projects yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="p-2.5 rounded-lg bg-[#F4F5FC]">
                      <p className="text-lg font-bold text-[#263247] tabular-nums">{projectStats.notStarted}</p>
                      <p className="text-[11px] text-[#8A91A3]">Not Started</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#7853E8]/8">
                      <p className="text-lg font-bold text-[#7853E8] tabular-nums">{projectStats.inProgress}</p>
                      <p className="text-[11px] text-[#8A91A3]">In Progress</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#2DAA82]/10">
                      <p className="text-lg font-bold text-[#2DAA82] tabular-nums">{projectStats.completed}</p>
                      <p className="text-[11px] text-[#8A91A3]">Completed</p>
                    </div>
                  </div>

                  <div className="h-28 w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectStats.chart} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={85}
                          tick={{ fill: '#4E596F', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2.5 mt-auto">
                    {dataset.projects.slice(0, 3).map((proj) => (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => navigateToRecord('projects', proj.id)}
                        className="w-full text-left p-2.5 rounded-lg border border-[#E7E9F1] hover:bg-[#F4F5FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#263247] truncate">{proj.name}</span>
                          <span className="text-xs font-mono text-[#7853E8] tabular-nums shrink-0">{proj.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#E7E9F1] rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-[#7853E8] rounded-full"
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Task Overview */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#263247]">Task Overview</h3>
                  <p className="text-xs text-[#8A91A3] tabular-nums">{taskStats.total} total tasks</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoute('tasks')}
                  className="text-xs font-semibold text-[#7853E8] hover:underline cursor-pointer"
                >
                  Open board
                </button>
              </div>

              {taskStats.total === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-[#8A91A3] py-10">
                  No tasks yet.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="p-3 rounded-lg bg-[#F4F5FC]">
                      <p className="text-xs text-[#8A91A3]">Pending</p>
                      <p className="text-xl font-bold text-[#263247] mt-0.5 tabular-nums">{taskStats.pending}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#7853E8]/8">
                      <p className="text-xs text-[#8A91A3]">In Progress</p>
                      <p className="text-xl font-bold text-[#7853E8] mt-0.5 tabular-nums">{taskStats.inProgress}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#2DAA82]/10">
                      <p className="text-xs text-[#8A91A3]">Completed</p>
                      <p className="text-xl font-bold text-[#2DAA82] mt-0.5 tabular-nums">{taskStats.completed}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#DC2626]/8">
                      <p className="text-xs text-[#8A91A3]">Overdue</p>
                      <p className="text-xl font-bold text-[#DC2626] mt-0.5 tabular-nums">{taskStats.overdue}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-auto">
                    {dataset.tasks
                      .filter((t) => t.status !== 'Completed')
                      .slice(0, 3)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => navigateToRecord('tasks', t.id)}
                          className="w-full text-left p-2.5 rounded-lg border border-[#E7E9F1] hover:bg-[#F4F5FC] flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#263247] truncate">{t.title}</p>
                            <p className="text-[11px] text-[#8A91A3] mt-0.5 tabular-nums">
                              Due {formatDisplayDate(t.dueDate, settings.preferences.dateFormat)}
                            </p>
                          </div>
                          <StatusBadge label={t.priority} />
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Financial Performance (User-defined Targets) */}
            <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#263247]">Financial Performance</h3>
                  <p className="text-xs text-[#8A91A3]">Compared with your {activeCurrency} targets</p>
                </div>
                <button
                  type="button"
                  onClick={openTargetEditor}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#263247] bg-[#F4F5FC] hover:bg-[#E7E9F1] rounded-lg transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Edit Targets</span>
                </button>
              </div>

              <div className="space-y-5 flex-1">
                {/* Income Target */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-[#4E596F]">Income vs Target</span>
                    <span className="font-semibold text-[#263247] tabular-nums">
                      {formatCurrency(activeCurrencyIncome, activeCurrency)} /{' '}
                      {currentTarget.incomeTarget > 0
                        ? formatCurrency(currentTarget.incomeTarget, activeCurrency)
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#F4F5FC] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7853E8] rounded-full transition-all"
                      style={{
                        width: `${
                          currentTarget.incomeTarget > 0
                            ? Math.min(100, Math.round((activeCurrencyIncome / currentTarget.incomeTarget) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Expenses vs Budget */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-[#4E596F]">Expenses vs Ceiling</span>
                    <span className="font-semibold text-[#263247] tabular-nums">
                      {formatCurrency(activeCurrencyExpenses, activeCurrency)} /{' '}
                      {currentTarget.expenseBudget > 0
                        ? formatCurrency(currentTarget.expenseBudget, activeCurrency)
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#F4F5FC] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#39B5B6] rounded-full transition-all"
                      style={{
                        width: `${
                          currentTarget.expenseBudget > 0
                            ? Math.min(100, Math.round((activeCurrencyExpenses / currentTarget.expenseBudget) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Profit vs Target */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-[#4E596F]">Net Profit vs Goal</span>
                    <span className="font-semibold text-[#263247] tabular-nums">
                      {formatCurrency(activeCurrencyProfit, activeCurrency)} /{' '}
                      {currentTarget.profitTarget > 0
                        ? formatCurrency(currentTarget.profitTarget, activeCurrency)
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#F4F5FC] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2DAA82] rounded-full transition-all"
                      style={{
                        width: `${
                          currentTarget.profitTarget > 0
                            ? Math.min(100, Math.max(0, Math.round((activeCurrencyProfit / currentTarget.profitTarget) * 100)))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#8A91A3] mt-5 pt-3 border-t border-[#E7E9F1]">
                Configure your own targets per currency using Edit Targets.
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#263247]">Recent Activity</h3>
                <p className="text-xs text-[#8A91A3]">Latest updates across your 8 connected business modules</p>
              </div>
              <button
                type="button"
                onClick={() => setRoute('analytics')}
                className="text-xs font-semibold text-[#7853E8] hover:underline cursor-pointer"
              >
                Open Analytics →
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <p className="text-xs text-[#8A91A3] py-4">No recent activity yet.</p>
            ) : (
              <div className="divide-y divide-[#E7E9F1]">
                {recentActivity.map((act) => (
                  <button
                    key={`${act.module}-${act.id}`}
                    type="button"
                    onClick={() => navigateToRecord(act.route, act.id)}
                    className="w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-[#F4F5FC] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[#8A91A3]">
                        <span className="font-semibold text-[#7853E8]">{act.module}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-sm font-medium text-[#263247] truncate">{act.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#8A91A3] shrink-0">
                      <span>{act.detail}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDisplayDate(act.timestamp, settings.preferences.dateFormat)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* User-defined Financial Targets Modal */}
      <Modal
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title={`Configure ${activeCurrency} Financial Targets`}
        subtitle="Set your own business goals. Progress bars update immediately."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateFinancialTargets(activeCurrency, draftTarget);
            setTargetModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">
              Income Target ({activeCurrency})
            </label>
            <input
              type="number"
              min={0}
              step="100"
              value={draftTarget.incomeTarget}
              onChange={(e) => setDraftTarget({ ...draftTarget, incomeTarget: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg focus:border-[#7853E8] outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">
              Expense Ceiling ({activeCurrency})
            </label>
            <input
              type="number"
              min={0}
              step="100"
              value={draftTarget.expenseBudget}
              onChange={(e) => setDraftTarget({ ...draftTarget, expenseBudget: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg focus:border-[#7853E8] outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">
              Net Profit Goal ({activeCurrency})
            </label>
            <input
              type="number"
              min={0}
              step="100"
              value={draftTarget.profitTarget}
              onChange={(e) => setDraftTarget({ ...draftTarget, profitTarget: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg focus:border-[#7853E8] outline-none tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button
              type="button"
              onClick={() => setTargetModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer"
            >
              Save Targets
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
