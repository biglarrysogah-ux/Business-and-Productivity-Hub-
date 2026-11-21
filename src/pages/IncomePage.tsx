import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit2, Plus, Search, Trash2, TrendingUp } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CurrencyCode, IncomeCategory, IncomeItem } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, groupAmountsByCurrency, SUPPORTED_CURRENCIES } from '../lib/currencies';
import { formatDisplayDate, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

const INCOME_CATEGORIES: IncomeCategory[] = [
  'Client Project',
  'Retainer',
  'Consulting',
  'Product Sales',
  'Maintenance',
  'Other',
];

function createEmptyIncome(defaultCurrency: CurrencyCode): IncomeItem {
  const now = new Date().toISOString();
  return {
    id: `inc-${Date.now()}`,
    title: '',
    date: REFERENCE_TODAY,
    clientId: '',
    projectId: '',
    invoiceId: '',
    category: 'Client Project',
    description: '',
    amount: 0,
    currency: defaultCurrency,
    paymentMethod: 'ACH Bank Transfer',
    isRecurring: false,
    verified: true,
    overview: '',
    breakdown: '',
    financialNotes: '',
    finalNotes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function IncomePage() {
  const {
    dataset,
    settings,
    upsertIncome,
    deleteIncome,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
  } = useHub();

  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<IncomeItem>(() => createEmptyIncome(settings.business.defaultCurrency));
  const [detailItem, setDetailItem] = useState<IncomeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'income') {
      setDraft(createEmptyIncome(settings.business.defaultCurrency));
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.incomes.find((i) => i.id === focusedRecordId);
      if (found) {
        setDetailItem(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.incomes, setFocusedRecordId]);

  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);
  const projectMap = useMemo(() => new Map(dataset.projects.map((p) => [p.id, p])), [dataset.projects]);
  const invoiceMap = useMemo(() => new Map(dataset.invoices.map((i) => [i.id, i])), [dataset.invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.incomes.filter((inc) => {
      if (q && !inc.title.toLowerCase().includes(q) && !inc.description.toLowerCase().includes(q)) return false;
      if (currencyFilter !== 'ALL' && inc.currency !== currencyFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      return true;
    });
  }, [dataset.incomes, search, currencyFilter, categoryFilter]);

  const groupedTotals = useMemo(() => groupAmountsByCurrency(filtered, (i) => i.amount), [filtered]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const next: IncomeItem = {
      ...draft,
      title: draft.title.trim(),
      clientId: draft.clientId || undefined,
      projectId: draft.projectId || undefined,
      invoiceId: draft.invoiceId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertIncome(next);
    if (detailItem?.id === next.id) setDetailItem(next);
    setFormOpen(false);
  };

  const columns: TableColumn<IncomeItem>[] = [
    {
      key: 'title',
      header: 'Income Record',
      sortable: true,
      sortValue: (i) => i.title,
      render: (i) => (
        <div>
          <p className="font-semibold text-[#263247]">{i.title}</p>
          <p className="text-xs text-[#8A91A3]">
            {i.category} {i.isRecurring ? `· Recurring (${i.recurringFrequency ?? 'Monthly'})` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (i) => i.date,
      render: (i) => (
        <span className="text-xs text-[#4E596F] tabular-nums">
          {formatDisplayDate(i.date, settings.preferences.dateFormat)}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Client / Project',
      render: (i) => (
        <div className="text-xs">
          <p className="text-[#263247]">{i.clientId ? clientMap.get(i.clientId)?.company : 'Standalone'}</p>
          <p className="text-[#8A91A3]">{i.projectId ? projectMap.get(i.projectId)?.name : 'No project linked'}</p>
        </div>
      ),
    },
    {
      key: 'verified',
      header: 'Verification',
      render: (i) => <StatusBadge label={i.verified ? 'Verified' : 'Pending Verification'} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      sortValue: (i) => i.amount,
      render: (i) => (
        <span className="font-semibold text-[#2DAA82] tabular-nums">
          {formatCurrency(i.amount, i.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setDraft(structuredClone(i));
              setFormOpen(true);
            }}
            aria-label={`Edit ${i.title}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(i)}
            aria-label={`Delete ${i.title}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#263247]">Income Tracker</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Track payments received, recurring retainers, invoice settlements, and currency-grouped totals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'income-export.csv',
                ['Title', 'Date', 'Category', 'Client', 'Amount', 'Currency', 'Method', 'Verified'],
                filtered.map((i) => [
                  i.title,
                  i.date,
                  i.category,
                  i.clientId ? clientMap.get(i.clientId)?.company ?? '' : '',
                  i.amount,
                  i.currency,
                  i.paymentMethod,
                  i.verified,
                ])
              )
            }
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#263247] bg-white border border-[#E7E9F1] hover:bg-[#F4F5FC] rounded-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(createEmptyIncome(settings.business.defaultCurrency));
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Income</span>
          </button>
        </div>
      </div>

      {/* Grouped Totals by Currency */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold text-[#8A91A3]">Recorded Totals (grouped by currency):</span>
        {groupedTotals.length === 0 ? (
          <span className="text-xs text-[#8A91A3]">No income entries</span>
        ) : (
          groupedTotals.map((g) => (
            <span key={g.currency} className="text-sm font-bold text-[#2DAA82] tabular-nums">
              {formatCurrency(g.total, g.currency)} <span className="text-xs font-normal text-[#8A91A3]">({g.count})</span>
            </span>
          ))
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search income records..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
        >
          <option value="ALL">All Categories</option>
          {INCOME_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter by currency"
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
        >
          <option value="ALL">All Currencies</option>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.code}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={dataset.incomes.length === 0 ? 'No income records yet.' : 'No income records match your filters'}
          description="Record client payments, retainers, or consulting income to update your dashboard metrics."
          actionLabel="Record Income"
          onAction={() => {
            setDraft(createEmptyIncome(settings.business.defaultCurrency));
            setFormOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyField={(i) => i.id}
          compact={settings.preferences.compactTables}
          onRowClick={(i) => setDetailItem(i)}
        />
      )}

      {/* Detail Drawer (All 10 Notion Income Template Sections) */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? ''}
        subtitle={detailItem ? `${formatCurrency(detailItem.amount, detailItem.currency)} · ${detailItem.date}` : undefined}
        variant="drawer"
        size="lg"
      >
        {detailItem && (
          <div className="space-y-4">
            {[
              ['1. Income Overview', detailItem.overview || detailItem.description],
              ['2. Client Information', detailItem.clientId ? clientMap.get(detailItem.clientId)?.company : 'Standalone / No client'],
              ['3. Income Description', detailItem.description],
              ['4. Income Breakdown', detailItem.breakdown || `${formatCurrency(detailItem.amount, detailItem.currency)} (${detailItem.category})`],
              ['5. Payment Information', detailItem.paymentMethod],
              ['6. Recurring Income', detailItem.isRecurring ? `Yes (${detailItem.recurringFrequency ?? 'Monthly'})` : 'One-time'],
              ['7. Related Invoice', detailItem.invoiceId ? invoiceMap.get(detailItem.invoiceId)?.invoiceNumber : 'None linked'],
              ['8. Income Verification', detailItem.verified ? 'Verified' : 'Pending verification'],
              ['9. Financial Notes', detailItem.financialNotes],
              ['10. Final Notes', detailItem.finalNotes],
            ].map(([label, content]) => (
              <section key={label} className="border-b border-[#E7E9F1] pb-3 last:border-b-0">
                <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">{label}</h4>
                <p className="text-sm text-[#263247] mt-1 whitespace-pre-line">{content || '—'}</p>
              </section>
            ))}
          </div>
        )}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={dataset.incomes.some((i) => i.id === draft.id) ? 'Edit Income Record' : 'Record Income'}
        subtitle="Preserves all 10 Notion Income Tracker template sections"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Title *</label>
              <input type="text" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Category</label>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as IncomeCategory })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                {INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Date</label>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Amount *</label>
              <input type="number" min={0} step="0.01" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Currency</label>
              <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as CurrencyCode })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Payment Method</label>
              <input type="text" value={draft.paymentMethod} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Client</label>
              <select value={draft.clientId ?? ''} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                <option value="">None</option>
                {dataset.clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Project</label>
              <select value={draft.projectId ?? ''} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                <option value="">None (Business-wide)</option>
                {dataset.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Related Invoice</label>
              <select value={draft.invoiceId ?? ''} onChange={(e) => setDraft({ ...draft, invoiceId: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                <option value="">None</option>
                {dataset.invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-medium text-[#263247] cursor-pointer">
              <input type="checkbox" checked={draft.verified} onChange={(e) => setDraft({ ...draft, verified: e.target.checked })} />
              <span>Payment Verified</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-[#263247] cursor-pointer">
              <input type="checkbox" checked={draft.isRecurring} onChange={(e) => setDraft({ ...draft, isRecurring: e.target.checked })} />
              <span>Recurring Income</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Description &amp; Financial Notes</label>
            <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
              Save Income
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteIncome(deleteTarget.id)}
        title="Delete Income Record"
        description={`Delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
