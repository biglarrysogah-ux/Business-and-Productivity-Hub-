import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit2,
  FileText,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CurrencyCode, InvoiceItem, InvoiceLineItem } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import {
  formatCurrency,
  getInvoiceComputedStatus,
  getInvoicePaidAmount,
  getInvoiceSubtotal,
  getInvoiceTotal,
  groupAmountsByCurrency,
  SUPPORTED_CURRENCIES,
} from '../lib/currencies';
import { formatDisplayDate, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

function createEmptyInvoice(defaultCurrency: CurrencyCode, nextNum: number, freelancerInfo: string): InvoiceItem {
  const now = new Date().toISOString();
  return {
    id: `inv-${Date.now()}`,
    invoiceNumber: `INV-2026-${String(nextNum).padStart(3, '0')}`,
    clientId: '',
    projectId: '',
    invoiceDate: REFERENCE_TODAY,
    dueDate: REFERENCE_TODAY,
    currency: defaultCurrency,
    lineItems: [{ id: `li-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }],
    taxRate: 0,
    paymentConfirmed: false,
    paidAmountRecorded: 0,
    overview: '',
    freelancerInfo,
    clientInfo: '',
    projectInfo: '',
    paymentInstructions: 'Bank Transfer / ACH',
    paymentTerms: 'Net 15',
    paymentRecordNotes: 'Awaiting payment verification.',
    finalNotes: 'Thank you for your business.',
    createdAt: now,
    updatedAt: now,
  };
}

export function InvoicesPage() {
  const {
    dataset,
    settings,
    upsertInvoice,
    deleteInvoice,
    recordInvoicePayment,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
  } = useHub();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');

  const defaultFreelancerInfo = [settings.business.businessName, settings.business.businessAddress]
    .filter(Boolean)
    .join(' · ');

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceItem>(() =>
    createEmptyInvoice(
      settings.business.defaultCurrency,
      dataset.invoices.length + 1,
      defaultFreelancerInfo
    )
  );
  const [detailInvoice, setDetailInvoice] = useState<InvoiceItem | null>(null);
  const [printInvoice, setPrintInvoice] = useState<InvoiceItem | null>(null);
  const [paymentModalInv, setPaymentModalInv] = useState<InvoiceItem | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('ACH Bank Transfer');
  const [payDate, setPayDate] = useState(REFERENCE_TODAY);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'invoice') {
      setDraft(
        createEmptyInvoice(
          settings.business.defaultCurrency,
          dataset.invoices.length + 1,
          defaultFreelancerInfo
        )
      );
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency, dataset.invoices.length, defaultFreelancerInfo]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.invoices.find((i) => i.id === focusedRecordId);
      if (found) {
        setDetailInvoice(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.invoices, setFocusedRecordId]);

  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);
  const projectMap = useMemo(() => new Map(dataset.projects.map((p) => [p.id, p])), [dataset.projects]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.invoices.filter((inv) => {
      const clientName = clientMap.get(inv.clientId)?.company || clientMap.get(inv.clientId)?.name || '';
      if (
        q &&
        !inv.invoiceNumber.toLowerCase().includes(q) &&
        !clientName.toLowerCase().includes(q) &&
        !inv.overview.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (currencyFilter !== 'ALL' && inv.currency !== currencyFilter) return false;
      const computed = getInvoiceComputedStatus(inv, dataset.incomes, REFERENCE_TODAY);
      if (statusFilter !== 'ALL' && computed !== statusFilter) return false;
      return true;
    });
  }, [dataset.invoices, dataset.incomes, search, statusFilter, currencyFilter, clientMap]);

  const outstandingSummary = useMemo(() => {
    const balances = filteredInvoices
      .map((inv) => ({
        currency: inv.currency,
        balance: Math.max(0, getInvoiceTotal(inv) - getInvoicePaidAmount(inv, dataset.incomes)),
      }))
      .filter((b) => b.balance > 0.01);
    return groupAmountsByCurrency(balances, (b) => b.balance);
  }, [filteredInvoices, dataset.incomes]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.invoiceNumber.trim() || !draft.clientId) return;
    const next: InvoiceItem = {
      ...draft,
      invoiceNumber: draft.invoiceNumber.trim(),
      projectId: draft.projectId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertInvoice(next);
    if (detailInvoice?.id === next.id) setDetailInvoice(next);
    setFormOpen(false);
  };

  const openRecordPayment = (inv: InvoiceItem) => {
    const total = getInvoiceTotal(inv);
    const paid = getInvoicePaidAmount(inv, dataset.incomes);
    setPayAmount(Math.max(0, Number((total - paid).toFixed(2))));
    setPayMethod('ACH Bank Transfer');
    setPayDate(REFERENCE_TODAY);
    setPaymentModalInv(inv);
  };

  const columns: TableColumn<InvoiceItem>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      sortable: true,
      sortValue: (inv) => inv.invoiceNumber,
      render: (inv) => (
        <div>
          <p className="font-mono text-xs font-semibold text-[#7853E8]">{inv.invoiceNumber}</p>
          <p className="text-xs text-[#8A91A3] mt-0.5">{clientMap.get(inv.clientId)?.company || clientMap.get(inv.clientId)?.name || 'Unknown'}</p>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Issued / Due',
      sortable: true,
      sortValue: (inv) => inv.dueDate,
      render: (inv) => (
        <div className="text-xs tabular-nums">
          <p className="text-[#263247]">{formatDisplayDate(inv.invoiceDate, settings.preferences.dateFormat)}</p>
          <p className="text-[#8A91A3]">Due {formatDisplayDate(inv.dueDate, settings.preferences.dateFormat)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Payment Status',
      render: (inv) => <StatusBadge label={getInvoiceComputedStatus(inv, dataset.incomes, REFERENCE_TODAY)} />,
    },
    {
      key: 'amount',
      header: 'Total',
      align: 'right',
      sortable: true,
      sortValue: (inv) => getInvoiceTotal(inv),
      render: (inv) => (
        <span className="font-semibold text-[#263247] tabular-nums">
          {formatCurrency(getInvoiceTotal(inv), inv.currency)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Outstanding',
      align: 'right',
      render: (inv) => {
        const balance = Math.max(0, getInvoiceTotal(inv) - getInvoicePaidAmount(inv, dataset.incomes));
        return (
          <span className={`font-semibold tabular-nums ${balance > 0.01 ? 'text-[#B97719]' : 'text-[#2DAA82]'}`}>
            {formatCurrency(balance, inv.currency)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (inv) => {
        const balance = Math.max(0, getInvoiceTotal(inv) - getInvoicePaidAmount(inv, dataset.incomes));
        return (
          <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {balance > 0.01 && (
              <button
                type="button"
                onClick={() => openRecordPayment(inv)}
                title="Record verified payment"
                className="px-2 py-1 text-[11px] font-medium text-[#2DAA82] bg-[#2DAA82]/10 hover:bg-[#2DAA82]/20 rounded-md cursor-pointer"
              >
                Record Pay
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintInvoice(inv)}
              aria-label={`Print ${inv.invoiceNumber}`}
              className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(structuredClone(inv));
                setFormOpen(true);
              }}
              aria-label={`Edit ${inv.invoiceNumber}`}
              className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(inv)}
              aria-label={`Delete ${inv.invoiceNumber}`}
              className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const updateLineItem = (idx: number, patch: Partial<InvoiceLineItem>) => {
    setDraft((d) => ({
      ...d,
      lineItems: d.lineItems.map((li, i) => (i === idx ? { ...li, ...patch } : li)),
    }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#263247]">Invoice Manager</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Create itemized invoices, verify payments against Income records, and print client-ready statements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'invoices-export.csv',
                ['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Currency', 'Total', 'Paid', 'Status'],
                filteredInvoices.map((inv) => [
                  inv.invoiceNumber,
                  clientMap.get(inv.clientId)?.company ?? '',
                  inv.invoiceDate,
                  inv.dueDate,
                  inv.currency,
                  getInvoiceTotal(inv).toFixed(2),
                  getInvoicePaidAmount(inv, dataset.incomes).toFixed(2),
                  getInvoiceComputedStatus(inv, dataset.incomes, REFERENCE_TODAY),
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
              setDraft(
                createEmptyInvoice(
                  settings.business.defaultCurrency,
                  dataset.invoices.length + 1,
                  defaultFreelancerInfo
                )
              );
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Outstanding Balance Strip grouped by currency */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold text-[#8A91A3]">Outstanding Balances (by currency):</span>
          {outstandingSummary.length === 0 ? (
            <span className="text-xs font-medium text-[#2DAA82]">All displayed invoices settled</span>
          ) : (
            outstandingSummary.map((g) => (
              <span key={g.currency} className="text-sm font-bold text-[#263247] tabular-nums">
                {formatCurrency(g.total, g.currency)} <span className="text-xs font-normal text-[#8A91A3]">({g.count})</span>
              </span>
            ))
          )}
        </div>
        <span className="text-xs text-[#8A91A3]">Invoices are marked Paid only when verified payment records confirm settlement.</span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice # or client..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <select
          aria-label="Filter by payment status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
        >
          <option value="ALL">All Statuses</option>
          {['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue'].map((s) => (
            <option key={s} value={s}>{s}</option>
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

      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={dataset.invoices.length === 0 ? 'No invoices available.' : 'No invoices match your filters'}
          description="Create an itemized invoice linked to a client and project to track receivables."
          actionLabel="Create Invoice"
          onAction={() => {
            setDraft(
              createEmptyInvoice(
                settings.business.defaultCurrency,
                dataset.invoices.length + 1,
                defaultFreelancerInfo
              )
            );
            setFormOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={filteredInvoices}
          columns={columns}
          keyField={(inv) => inv.id}
          compact={settings.preferences.compactTables}
          onRowClick={(inv) => setDetailInvoice(inv)}
        />
      )}

      {/* Invoice Detail Drawer (All 10 Notion Template Sections) */}
      <Modal
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        title={detailInvoice?.invoiceNumber ?? ''}
        subtitle={detailInvoice ? clientMap.get(detailInvoice.clientId)?.company : undefined}
        variant="drawer"
        size="xl"
        headerActions={
          detailInvoice && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPrintInvoice(detailInvoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(structuredClone(detailInvoice));
                  setFormOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
              >
                Edit
              </button>
            </div>
          )
        }
      >
        {detailInvoice && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FD] p-4 rounded-xl border border-[#E7E9F1]">
              <div>
                <p className="text-[11px] text-[#8A91A3]">Status</p>
                <div className="mt-1">
                  <StatusBadge label={getInvoiceComputedStatus(detailInvoice, dataset.incomes, REFERENCE_TODAY)} />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[#8A91A3]">Invoice Total</p>
                <p className="text-sm font-bold text-[#263247] mt-1 tabular-nums">
                  {formatCurrency(getInvoiceTotal(detailInvoice), detailInvoice.currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#8A91A3]">Verified Paid</p>
                <p className="text-sm font-bold text-[#2DAA82] mt-1 tabular-nums">
                  {formatCurrency(getInvoicePaidAmount(detailInvoice, dataset.incomes), detailInvoice.currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#8A91A3]">Outstanding</p>
                <p className="text-sm font-bold text-[#B97719] mt-1 tabular-nums">
                  {formatCurrency(
                    Math.max(0, getInvoiceTotal(detailInvoice) - getInvoicePaidAmount(detailInvoice, dataset.incomes)),
                    detailInvoice.currency
                  )}
                </p>
              </div>
            </div>

            {/* 5. Services & Itemized Charges */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">5. Services &amp; Itemized Charges</h4>
              <div className="border border-[#E7E9F1] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FD] border-b border-[#E7E9F1] text-[#8A91A3]">
                    <tr>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9F1]">
                    {detailInvoice.lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="px-3 py-2.5 text-[#263247]">{li.description}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{li.quantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(li.unitPrice, detailInvoice.currency)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {formatCurrency(li.quantity * li.unitPrice, detailInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {[
              ['1. Invoice Overview', detailInvoice.overview],
              ['2. Freelancer Information', detailInvoice.freelancerInfo],
              ['3. Client Information', detailInvoice.clientInfo],
              ['4. Project Information', detailInvoice.projectInfo || projectMap.get(detailInvoice.projectId ?? '')?.name],
              ['6. Invoice Summary', `Subtotal: ${formatCurrency(getInvoiceSubtotal(detailInvoice), detailInvoice.currency)} · Tax (${detailInvoice.taxRate}%): ${formatCurrency(getInvoiceTotal(detailInvoice) - getInvoiceSubtotal(detailInvoice), detailInvoice.currency)} · Total: ${formatCurrency(getInvoiceTotal(detailInvoice), detailInvoice.currency)}`],
              ['7. Payment Information', detailInvoice.paymentInstructions],
              ['8. Payment Terms', detailInvoice.paymentTerms],
              ['9. Payment Record', detailInvoice.paymentRecordNotes],
              ['10. Final Notes', detailInvoice.finalNotes],
            ].map(([label, content]) => (
              <section key={label} className="border-t border-[#E7E9F1] pt-3 space-y-1">
                <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">{label}</h4>
                <p className="text-sm text-[#263247] whitespace-pre-line">{content || '—'}</p>
              </section>
            ))}
          </div>
        )}
      </Modal>

      {/* Print-Friendly Invoice Modal */}
      <Modal
        open={!!printInvoice}
        onClose={() => setPrintInvoice(null)}
        title={`Print Preview — ${printInvoice?.invoiceNumber ?? ''}`}
        size="xl"
        headerActions={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer no-print"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        }
      >
        {printInvoice && (
          <div className="print-only-container bg-white p-6 space-y-6 text-[#263247]">
            <div className="flex justify-between items-start border-b border-[#E7E9F1] pb-5">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  {settings.business.businessName || 'Business Details Not Configured'}
                </h2>
                {settings.business.businessAddress && (
                  <p className="text-xs text-[#8A91A3] mt-1">{settings.business.businessAddress}</p>
                )}
                {settings.business.taxId && (
                  <p className="text-xs text-[#8A91A3]">{settings.business.taxId}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-[#8A91A3]">Invoice</p>
                <p className="font-mono text-lg font-bold text-[#7853E8]">{printInvoice.invoiceNumber}</p>
                <p className="text-xs text-[#4E596F] mt-1 tabular-nums">
                  Issued: {formatDisplayDate(printInvoice.invoiceDate, settings.preferences.dateFormat)}
                </p>
                <p className="text-xs text-[#4E596F] tabular-nums">
                  Due: {formatDisplayDate(printInvoice.dueDate, settings.preferences.dateFormat)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <p className="font-semibold text-[#8A91A3] uppercase mb-1">Bill To</p>
                <p className="font-semibold text-sm">{clientMap.get(printInvoice.clientId)?.company}</p>
                <p>{clientMap.get(printInvoice.clientId)?.name}</p>
                <p className="text-[#8A91A3]">{clientMap.get(printInvoice.clientId)?.email}</p>
              </div>
              <div>
                <p className="font-semibold text-[#8A91A3] uppercase mb-1">Project &amp; Terms</p>
                <p>{projectMap.get(printInvoice.projectId ?? '')?.name || printInvoice.projectInfo || '—'}</p>
                <p className="text-[#8A91A3] mt-1">Terms: {printInvoice.paymentTerms}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-y border-[#E7E9F1] bg-[#F8F9FD] text-xs text-[#8A91A3]">
                  <th className="py-2.5 px-3">Service / Item</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9F1]">
                {printInvoice.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-3 px-3">{li.description}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{li.quantity}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(li.unitPrice, printInvoice.currency)}</td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums">
                      {formatCurrency(li.quantity * li.unitPrice, printInvoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-xs text-[#8A91A3]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(getInvoiceSubtotal(printInvoice), printInvoice.currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8A91A3]">
                  <span>Tax ({printInvoice.taxRate}%)</span>
                  <span className="tabular-nums">
                    {formatCurrency(getInvoiceTotal(printInvoice) - getInvoiceSubtotal(printInvoice), printInvoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-[#E7E9F1] pt-2">
                  <span>Total ({printInvoice.currency})</span>
                  <span className="tabular-nums">{formatCurrency(getInvoiceTotal(printInvoice), printInvoice.currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#2DAA82]">
                  <span>Verified Paid</span>
                  <span className="tabular-nums">
                    {formatCurrency(getInvoicePaidAmount(printInvoice, dataset.incomes), printInvoice.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E7E9F1] pt-4 text-xs text-[#8A91A3] space-y-1">
              <p><strong className="text-[#263247]">Payment Instructions:</strong> {printInvoice.paymentInstructions}</p>
              <p>{printInvoice.finalNotes}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={!!paymentModalInv}
        onClose={() => setPaymentModalInv(null)}
        title={`Record Payment — ${paymentModalInv?.invoiceNumber ?? ''}`}
        subtitle="Creates a verified Income entry linked to this invoice"
        size="md"
      >
        {paymentModalInv && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              recordInvoicePayment(paymentModalInv.id, payAmount, payMethod, payDate);
              setPaymentModalInv(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">
                Amount Received ({paymentModalInv.currency})
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Payment Method</label>
              <input
                type="text"
                required
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
              <button
                type="button"
                onClick={() => setPaymentModalInv(null)}
                className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2DAA82] hover:bg-[#23906D] rounded-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify &amp; Record</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create / Edit Invoice Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={dataset.invoices.some((i) => i.id === draft.id) ? 'Edit Invoice' : 'Create Invoice'}
        subtitle="Preserves all 10 Notion Invoice Manager template sections"
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Invoice # *</label>
              <input
                type="text"
                required
                value={draft.invoiceNumber}
                onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Client *</label>
              <select
                required
                value={draft.clientId}
                onChange={(e) => {
                  const cid = e.target.value;
                  const cli = clientMap.get(cid);
                  setDraft({
                    ...draft,
                    clientId: cid,
                    currency: cli?.preferredCurrency ?? draft.currency,
                    clientInfo: cli ? `${cli.company} · ${cli.name} · ${cli.location}` : draft.clientInfo,
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                <option value="">Select client...</option>
                {dataset.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company || c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Related Project</label>
              <select
                value={draft.projectId ?? ''}
                onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                <option value="">None</option>
                {dataset.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Currency</label>
              <select
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as CurrencyCode })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Invoice Date</label>
              <input
                type="date"
                value={draft.invoiceDate}
                onChange={(e) => setDraft({ ...draft, invoiceDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Due Date</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={draft.taxRate}
                onChange={(e) => setDraft({ ...draft, taxRate: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums"
              />
            </div>
          </div>

          {/* Itemized Line Items */}
          <div className="space-y-2 border border-[#E7E9F1] rounded-xl p-3 bg-[#F8F9FD]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#263247]">5. Services &amp; Itemized Charges</span>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    lineItems: [...d.lineItems, { id: `li-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }],
                  }))
                }
                className="text-xs font-semibold text-[#7853E8] hover:underline cursor-pointer"
              >
                + Add Line Item
              </button>
            </div>
            {draft.lineItems.map((li, idx) => (
              <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  required
                  placeholder="Service description"
                  value={li.description}
                  onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                  className="col-span-6 px-2.5 py-1.5 text-xs bg-white border border-[#E7E9F1] rounded-lg"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(idx, { quantity: Number(e.target.value) })}
                  className="col-span-2 px-2.5 py-1.5 text-xs bg-white border border-[#E7E9F1] rounded-lg tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Rate"
                  value={li.unitPrice}
                  onChange={(e) => updateLineItem(idx, { unitPrice: Number(e.target.value) })}
                  className="col-span-3 px-2.5 py-1.5 text-xs bg-white border border-[#E7E9F1] rounded-lg tabular-nums"
                />
                <button
                  type="button"
                  disabled={draft.lineItems.length <= 1}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      lineItems: d.lineItems.filter((_, i) => i !== idx),
                    }))
                  }
                  className="col-span-1 text-xs text-[#DC2626] disabled:opacity-30 cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="text-right text-xs font-bold text-[#263247] pt-1 tabular-nums">
              Invoice Total: {formatCurrency(getInvoiceTotal(draft), draft.currency)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">1. Invoice Overview</label>
              <textarea rows={2} value={draft.overview} onChange={(e) => setDraft({ ...draft, overview: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">7. Payment Information</label>
              <textarea rows={2} value={draft.paymentInstructions} onChange={(e) => setDraft({ ...draft, paymentInstructions: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">8. Payment Terms</label>
              <input type="text" value={draft.paymentTerms} onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">10. Final Notes</label>
              <input type="text" value={draft.finalNotes} onChange={(e) => setDraft({ ...draft, finalNotes: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
              Save Invoice
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteInvoice(deleteTarget.id)}
        title="Delete Invoice"
        description={`Delete invoice "${deleteTarget?.invoiceNumber}"? Linked income records will remain intact.`}
      />
    </div>
  );
}
