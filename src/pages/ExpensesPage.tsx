import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit2, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CurrencyCode, ExpenseCategory, ExpenseItem } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, groupAmountsByCurrency, SUPPORTED_CURRENCIES } from '../lib/currencies';
import { formatDisplayDate, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Software & SaaS',
  'Contractors',
  'Marketing',
  'Equipment',
  'Travel',
  'Office & Utilities',
  'Professional Fees',
  'Other',
];

function createEmptyExpense(defaultCurrency: CurrencyCode): ExpenseItem {
  const now = new Date().toISOString();
  return {
    id: `exp-${Date.now()}`,
    title: '',
    date: REFERENCE_TODAY,
    vendor: '',
    category: 'Software & SaaS',
    description: '',
    amount: 0,
    currency: defaultCurrency,
    paymentMethod: 'Corporate Card',
    clientId: '',
    projectId: '',
    receiptRef: '',
    isRecurring: false,
    taxDeductible: true,
    overview: '',
    breakdown: '',
    taxNotes: '',
    finalNotes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function ExpensesPage() {
  const {
    dataset,
    settings,
    upsertExpense,
    deleteExpense,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
  } = useHub();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [taxFilter, setTaxFilter] = useState<'ALL' | 'deductible' | 'non'>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ExpenseItem>(() => createEmptyExpense(settings.business.defaultCurrency));
  const [detailItem, setDetailItem] = useState<ExpenseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'expense') {
      setDraft(createEmptyExpense(settings.business.defaultCurrency));
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.expenses.find((e) => e.id === focusedRecordId);
      if (found) {
        setDetailItem(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.expenses, setFocusedRecordId]);

  const projectMap = useMemo(() => new Map(dataset.projects.map((p) => [p.id, p])), [dataset.projects]);
  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.expenses.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q) && !e.vendor.toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (currencyFilter !== 'ALL' && e.currency !== currencyFilter) return false;
      if (taxFilter === 'deductible' && !e.taxDeductible) return false;
      if (taxFilter === 'non' && e.taxDeductible) return false;
      return true;
    });
  }, [dataset.expenses, search, categoryFilter, currencyFilter, taxFilter]);

  const groupedTotals = useMemo(() => groupAmountsByCurrency(filtered, (e) => e.amount), [filtered]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const next: ExpenseItem = {
      ...draft,
      title: draft.title.trim(),
      clientId: draft.clientId || undefined,
      projectId: draft.projectId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertExpense(next);
    if (detailItem?.id === next.id) setDetailItem(next);
    setFormOpen(false);
  };

  const columns: TableColumn<ExpenseItem>[] = [
    {
      key: 'title',
      header: 'Expense',
      sortable: true,
      sortValue: (e) => e.title,
      render: (e) => (
        <div>
          <p className="font-semibold text-[#263247]">{e.title}</p>
          <p className="text-xs text-[#8A91A3]">
            {e.vendor} · {e.category}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (e) => e.date,
      render: (e) => (
        <span className="text-xs text-[#4E596F] tabular-nums">
          {formatDisplayDate(e.date, settings.preferences.dateFormat)}
        </span>
      ),
    },
    {
      key: 'project',
      header: 'Linked Project',
      render: (e) => (
        <span className="text-xs text-[#4E596F]">
          {e.projectId ? projectMap.get(e.projectId)?.name : 'General Overhead'}
        </span>
      ),
    },
    {
      key: 'tax',
      header: 'Tax Status',
      render: (e) => <StatusBadge label={e.taxDeductible ? 'Deductible' : 'Non-Deductible'} tone={e.taxDeductible ? 'teal' : 'neutral'} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      sortValue: (e) => e.amount,
      render: (e) => (
        <span className="font-semibold text-[#263247] tabular-nums">
          {formatCurrency(e.amount, e.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) => (
        <div className="inline-flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setDraft(structuredClone(e));
              setFormOpen(true);
            }}
            aria-label={`Edit ${e.title}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(e)}
            aria-label={`Delete ${e.title}`}
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
          <h2 className="font-display text-2xl font-bold text-[#263247]">Expense Tracker</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Track vendors, project costs, business overhead, receipts, and tax-deductible expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'expenses-export.csv',
                ['Title', 'Date', 'Vendor', 'Category', 'Amount', 'Currency', 'Tax Deductible', 'Receipt'],
                filtered.map((e) => [e.title, e.date, e.vendor, e.category, e.amount, e.currency, e.taxDeductible, e.receiptRef])
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
              setDraft(createEmptyExpense(settings.business.defaultCurrency));
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Grouped Totals */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold text-[#8A91A3]">Expense Totals (grouped by currency):</span>
        {groupedTotals.length === 0 ? (
          <span className="text-xs text-[#8A91A3]">No expense records</span>
        ) : (
          groupedTotals.map((g) => (
            <span key={g.currency} className="text-sm font-bold text-[#263247] tabular-nums">
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
            placeholder="Search expense or vendor..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]">
          <option value="ALL">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]">
          <option value="ALL">All Currencies</option>
          {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
        <select value={taxFilter} onChange={(e) => setTaxFilter(e.target.value as typeof taxFilter)} className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]">
          <option value="ALL">All Tax Statuses</option>
          <option value="deductible">Tax Deductible</option>
          <option value="non">Non-Deductible</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={dataset.expenses.length === 0 ? 'No expense records yet.' : 'No expense records match your filters'}
          description="Log contractor payouts, SaaS subscriptions, travel, or office expenses."
          actionLabel="Add Expense"
          onAction={() => {
            setDraft(createEmptyExpense(settings.business.defaultCurrency));
            setFormOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyField={(e) => e.id}
          compact={settings.preferences.compactTables}
          onRowClick={(e) => setDetailItem(e)}
        />
      )}

      {/* Detail Drawer (All 10 Notion Expense Template Sections) */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? ''}
        subtitle={detailItem ? `${detailItem.vendor} · ${formatCurrency(detailItem.amount, detailItem.currency)}` : undefined}
        variant="drawer"
        size="lg"
      >
        {detailItem && (
          <div className="space-y-4">
            {[
              ['1. Expense Overview', detailItem.overview || detailItem.description],
              ['2. Vendor / Supplier Information', detailItem.vendor],
              ['3. Expense Details', detailItem.description],
              ['4. Expense Breakdown', detailItem.breakdown || `${formatCurrency(detailItem.amount, detailItem.currency)} (${detailItem.category})`],
              ['5. Payment Information', detailItem.paymentMethod],
              ['6. Related Client or Project', `${detailItem.clientId ? clientMap.get(detailItem.clientId)?.company : 'None'} · ${detailItem.projectId ? projectMap.get(detailItem.projectId)?.name : 'General overhead'}`],
              ['7. Receipt & Documentation', detailItem.receiptRef || 'No receipt ID recorded'],
              ['8. Tax & Deductibility', `${detailItem.taxDeductible ? 'Tax Deductible' : 'Non-Deductible'} ${detailItem.taxNotes ? `— ${detailItem.taxNotes}` : ''}`],
              ['9. Recurring Expense', detailItem.isRecurring ? `Yes (${detailItem.recurringFrequency ?? 'Monthly'})` : 'One-time'],
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
        title={dataset.expenses.some((e) => e.id === draft.id) ? 'Edit Expense' : 'Add Expense'}
        subtitle="Preserves all 10 Notion Expense Tracker template sections"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Title *</label>
              <input type="text" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Vendor / Supplier *</label>
              <input type="text" required value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Date</label>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Category</label>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ExpenseCategory })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Related Project</label>
              <select value={draft.projectId ?? ''} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                <option value="">General Overhead</option>
                {dataset.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Payment Method</label>
              <input type="text" value={draft.paymentMethod} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Receipt Reference</label>
              <input type="text" value={draft.receiptRef} onChange={(e) => setDraft({ ...draft, receiptRef: e.target.value })} placeholder="Receipt or reference ID" className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-medium text-[#263247] cursor-pointer">
              <input type="checkbox" checked={draft.taxDeductible} onChange={(e) => setDraft({ ...draft, taxDeductible: e.target.checked })} />
              <span>Tax Deductible</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-[#263247] cursor-pointer">
              <input type="checkbox" checked={draft.isRecurring} onChange={(e) => setDraft({ ...draft, isRecurring: e.target.checked })} />
              <span>Recurring Expense</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Details &amp; Tax Notes</label>
            <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteExpense(deleteTarget.id)}
        title="Delete Expense"
        description={`Delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
