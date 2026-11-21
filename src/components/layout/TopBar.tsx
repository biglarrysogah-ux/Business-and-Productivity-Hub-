import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Bell,
  Calendar,
  Menu,
  Search,
  Settings,
  AlertCircle,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { useHub } from '../../context/HubContext';
import { NAV_ITEMS } from './Sidebar';
import { CurrencyCode, NavRoute, ReportingPeriod } from '../../types/business';
import { SUPPORTED_CURRENCIES, getInvoiceComputedStatus, getInvoiceTotal, formatCurrency } from '../../lib/currencies';
import { REFERENCE_TODAY } from '../../lib/dateUtils';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  moduleLabel: string;
  route: NavRoute;
}

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export function TopBar({ onOpenMobileMenu }: TopBarProps) {
  const {
    route,
    setRoute,
    navigateToRecord,
    reportingPeriod,
    setReportingPeriod,
    currencyFilter,
    setCurrencyFilter,
    dataset,
    settings,
  } = useHub();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentNav = NAV_ITEMS.find((n) => n.id === route);
  const pageTitle = currentNav?.label ?? 'Dashboard';

  // Live global search across all 8 modules
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];

    dataset.tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || t.overview.toLowerCase().includes(q)) {
        results.push({ id: t.id, title: t.title, subtitle: `${t.status} · Due ${t.dueDate}`, moduleLabel: 'Tasks', route: 'tasks' });
      }
    });
    dataset.projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.overview.toLowerCase().includes(q)) {
        results.push({ id: p.id, title: p.name, subtitle: `${p.status} · ${p.progress}%`, moduleLabel: 'Projects', route: 'projects' });
      }
    });
    dataset.clients.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
        results.push({ id: c.id, title: c.company || c.name, subtitle: `${c.name} · ${c.status}`, moduleLabel: 'Clients', route: 'clients' });
      }
    });
    dataset.invoices.forEach((inv) => {
      if (inv.invoiceNumber.toLowerCase().includes(q) || inv.overview.toLowerCase().includes(q)) {
        results.push({
          id: inv.id,
          title: inv.invoiceNumber,
          subtitle: `${formatCurrency(getInvoiceTotal(inv), inv.currency)} · Due ${inv.dueDate}`,
          moduleLabel: 'Invoices',
          route: 'invoices',
        });
      }
    });
    dataset.incomes.forEach((inc) => {
      if (inc.title.toLowerCase().includes(q) || inc.description.toLowerCase().includes(q)) {
        results.push({
          id: inc.id,
          title: inc.title,
          subtitle: `${formatCurrency(inc.amount, inc.currency)} · ${inc.date}`,
          moduleLabel: 'Income',
          route: 'income',
        });
      }
    });
    dataset.expenses.forEach((exp) => {
      if (exp.title.toLowerCase().includes(q) || exp.vendor.toLowerCase().includes(q)) {
        results.push({
          id: exp.id,
          title: exp.title,
          subtitle: `${exp.vendor} · ${formatCurrency(exp.amount, exp.currency)}`,
          moduleLabel: 'Expenses',
          route: 'expenses',
        });
      }
    });
    dataset.timeEntries.forEach((te) => {
      if (te.title.toLowerCase().includes(q) || te.workOverview.toLowerCase().includes(q)) {
        results.push({ id: te.id, title: te.title, subtitle: `${te.workDate} · ${te.durationMinutes}m`, moduleLabel: 'Time', route: 'time-tracking' });
      }
    });
    dataset.proposals.forEach((pr) => {
      if (pr.title.toLowerCase().includes(q) || pr.overview.toLowerCase().includes(q)) {
        results.push({
          id: pr.id,
          title: pr.title,
          subtitle: `${pr.status} · ${formatCurrency(pr.proposedAmount, pr.currency)}`,
          moduleLabel: 'Proposals',
          route: 'proposals',
        });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery, dataset]);

  // Computed notifications from actual workspace records
  const notifications = useMemo(() => {
    const list: { id: string; title: string; detail: string; route: NavRoute; recordId: string; type: 'invoice' | 'task' | 'proposal' }[] = [];

    dataset.invoices.forEach((inv) => {
      const status = getInvoiceComputedStatus(inv, dataset.incomes, REFERENCE_TODAY);
      if (status === 'Overdue') {
        list.push({
          id: `n-inv-${inv.id}`,
          title: `Overdue invoice ${inv.invoiceNumber}`,
          detail: `Due ${inv.dueDate} · ${formatCurrency(getInvoiceTotal(inv), inv.currency)}`,
          route: 'invoices',
          recordId: inv.id,
          type: 'invoice',
        });
      }
    });

    dataset.tasks.forEach((t) => {
      if (t.status !== 'Completed' && t.dueDate && t.dueDate < REFERENCE_TODAY) {
        list.push({
          id: `n-task-${t.id}`,
          title: `Overdue task: ${t.title}`,
          detail: `Due ${t.dueDate} · ${t.priority} priority`,
          route: 'tasks',
          recordId: t.id,
          type: 'task',
        });
      }
    });

    dataset.proposals.forEach((p) => {
      if (p.status === 'Follow-up Due') {
        list.push({
          id: `n-prop-${p.id}`,
          title: `Proposal follow-up due`,
          detail: `${p.title} · Follow up ${p.followUpDate}`,
          route: 'proposals',
          recordId: p.id,
          type: 'proposal',
        });
      }
    });

    return list;
  }, [dataset]);

  const activeCurrenciesInData = useMemo(() => {
    const set = new Set<CurrencyCode>([settings.business.defaultCurrency]);
    dataset.incomes.forEach((i) => set.add(i.currency));
    dataset.expenses.forEach((e) => set.add(e.currency));
    dataset.invoices.forEach((inv) => set.add(inv.currency));
    return SUPPORTED_CURRENCIES.filter((c) => set.has(c.code));
  }, [dataset, settings.business.defaultCurrency]);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#E7E9F1] px-4 sm:px-6 flex items-center justify-between gap-3">
      {/* Left: Mobile drawer trigger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-base sm:text-lg font-semibold text-[#263247] truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Center / Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global Search */}
        <div ref={searchRef} className="relative hidden md:block w-64 xl:w-80">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search tasks, clients, invoices..."
            aria-label="Global workspace search"
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg text-[#263247] placeholder-[#8A91A3] outline-none transition-colors"
          />

          {searchOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-[#E7E9F1] rounded-xl shadow-xl overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <div className="p-4 text-xs text-[#8A91A3] text-center">
                  No matching records across your 8 modules.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-[#E7E9F1]">
                  {searchResults.map((res) => (
                    <button
                      key={`${res.route}-${res.id}`}
                      type="button"
                      onClick={() => {
                        navigateToRecord(res.route, res.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#F4F5FC] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#263247] truncate">{res.title}</p>
                        <p className="text-xs text-[#8A91A3] truncate">{res.subtitle}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[#7853E8] shrink-0">
                        {res.moduleLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reporting Period Selector */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg px-2.5 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#7853E8] shrink-0" />
          <select
            aria-label="Reporting period"
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value as ReportingPeriod)}
            className="bg-transparent text-xs font-medium text-[#263247] outline-none cursor-pointer pr-1"
          >
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_quarter">This Quarter</option>
            <option value="year_to_date">Year to Date</option>
            <option value="all_time">All Time</option>
          </select>
        </div>

        {/* Currency View Selector */}
        <div className="hidden xl:flex items-center bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg px-2.5 py-1.5">
          <select
            aria-label="Reporting currency filter"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value as CurrencyCode | 'ALL')}
            className="bg-transparent text-xs font-medium text-[#263247] outline-none cursor-pointer"
          >
            <option value="ALL">All Currencies (Grouped)</option>
            {activeCurrenciesInData.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol.trim()})
              </option>
            ))}
          </select>
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Workspace notifications"
            className="relative p-2 rounded-lg text-[#4E596F] hover:text-[#263247] hover:bg-[#F4F5FC] transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E9AD58]" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E7E9F1] rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E7E9F1] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#263247]">Action Reminders</span>
                <span className="text-xs text-[#8A91A3] tabular-nums">{notifications.length} items</span>
              </div>
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8A91A3]">
                  No overdue invoices, overdue tasks, or pending follow-ups.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-[#E7E9F1]">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        navigateToRecord(n.route, n.recordId);
                        setNotifOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[#F4F5FC] flex items-start gap-3 cursor-pointer"
                    >
                      {n.type === 'invoice' ? (
                        <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                      ) : n.type === 'task' ? (
                        <Clock className="w-4 h-4 text-[#E9AD58] shrink-0 mt-0.5" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-[#7853E8] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#263247] truncate">{n.title}</p>
                        <p className="text-xs text-[#8A91A3] mt-0.5 truncate">{n.detail}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Neutral Settings Icon */}
        <button
          type="button"
          onClick={() => setRoute('settings')}
          aria-label="Workspace settings"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            route === 'settings'
              ? 'bg-[#7853E8]/10 text-[#7853E8]'
              : 'text-[#4E596F] hover:text-[#263247] hover:bg-[#F4F5FC]'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
