import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit2, FileSpreadsheet, Plus, Search, Trash2 } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CurrencyCode, ProposalItem, ProposalStatus } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, groupAmountsByCurrency, SUPPORTED_CURRENCIES } from '../lib/currencies';
import { formatDisplayDate, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

const PROPOSAL_STATUSES: ProposalStatus[] = [
  'Draft',
  'Sent',
  'Under Review',
  'Follow-up Due',
  'Accepted',
  'Declined',
];

function createEmptyProposal(defaultCurrency: CurrencyCode): ProposalItem {
  const now = new Date().toISOString();
  return {
    id: `prop-${Date.now()}`,
    title: '',
    clientId: '',
    projectId: '',
    status: 'Draft',
    submissionDate: REFERENCE_TODAY,
    followUpDate: REFERENCE_TODAY,
    proposedAmount: 0,
    currency: defaultCurrency,
    overview: '',
    scopeDeliverables: '',
    timelineMilestones: '',
    pricingTerms: '',
    requirements: '',
    termsConditions: '',
    expectedResults: '',
    nextSteps: '',
    followUpNotes: '',
    finalApproval: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function ProposalsPage() {
  const {
    dataset,
    settings,
    upsertProposal,
    deleteProposal,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
  } = useHub();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ProposalItem>(() => createEmptyProposal(settings.business.defaultCurrency));
  const [detailItem, setDetailItem] = useState<ProposalItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProposalItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'proposal') {
      setDraft(createEmptyProposal(settings.business.defaultCurrency));
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.proposals.find((p) => p.id === focusedRecordId);
      if (found) {
        setDetailItem(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.proposals, setFocusedRecordId]);

  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);
  const projectMap = useMemo(() => new Map(dataset.projects.map((p) => [p.id, p])), [dataset.projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.proposals.filter((p) => {
      const cli = clientMap.get(p.clientId)?.company || '';
      if (q && !p.title.toLowerCase().includes(q) && !cli.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      return true;
    });
  }, [dataset.proposals, search, statusFilter, clientMap]);

  const activePipelineTotals = useMemo(
    () =>
      groupAmountsByCurrency(
        filtered.filter((p) => p.status !== 'Declined'),
        (p) => p.proposedAmount
      ),
    [filtered]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.clientId) return;
    const next: ProposalItem = {
      ...draft,
      title: draft.title.trim(),
      projectId: draft.projectId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertProposal(next);
    if (detailItem?.id === next.id) setDetailItem(next);
    setFormOpen(false);
  };

  const columns: TableColumn<ProposalItem>[] = [
    {
      key: 'title',
      header: 'Proposal',
      sortable: true,
      sortValue: (p) => p.title,
      render: (p) => (
        <div>
          <p className="font-semibold text-[#263247]">{p.title}</p>
          <p className="text-xs text-[#8A91A3]">
            {clientMap.get(p.clientId)?.company || clientMap.get(p.clientId)?.name || 'Unknown client'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (p) => p.status,
      render: (p) => <StatusBadge label={p.status} />,
    },
    {
      key: 'dates',
      header: 'Submitted / Follow-up',
      sortable: true,
      sortValue: (p) => p.followUpDate,
      render: (p) => (
        <div className="text-xs tabular-nums">
          <p className="text-[#263247]">{formatDisplayDate(p.submissionDate, settings.preferences.dateFormat)}</p>
          <p className="text-[#8A91A3]">Follow up {formatDisplayDate(p.followUpDate, settings.preferences.dateFormat)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Proposed Value',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.proposedAmount,
      render: (p) => (
        <span className="font-semibold text-[#263247] tabular-nums">
          {formatCurrency(p.proposedAmount, p.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setDraft(structuredClone(p));
              setFormOpen(true);
            }}
            aria-label={`Edit ${p.title}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(p)}
            aria-label={`Delete ${p.title}`}
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
          <h2 className="font-display text-2xl font-bold text-[#263247]">Proposal Tracker</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Track commercial proposals, follow-up dates, scope deliverables, and approval status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'proposals-export.csv',
                ['Title', 'Client', 'Status', 'Submitted', 'Follow-up', 'Amount', 'Currency'],
                filtered.map((p) => [
                  p.title,
                  clientMap.get(p.clientId)?.company ?? '',
                  p.status,
                  p.submissionDate,
                  p.followUpDate,
                  p.proposedAmount,
                  p.currency,
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
              setDraft(createEmptyProposal(settings.business.defaultCurrency));
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Proposal</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold text-[#8A91A3]">Pipeline Totals (excl. declined, by currency):</span>
        {activePipelineTotals.length === 0 ? (
          <span className="text-xs text-[#8A91A3]">No active proposals</span>
        ) : (
          activePipelineTotals.map((g) => (
            <span key={g.currency} className="text-sm font-bold text-[#7853E8] tabular-nums">
              {formatCurrency(g.total, g.currency)} <span className="text-xs font-normal text-[#8A91A3]">({g.count})</span>
            </span>
          ))
        )}
      </div>

      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proposals or clients..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]">
          <option value="ALL">All Statuses</option>
          {PROPOSAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={dataset.proposals.length === 0 ? 'No proposals yet.' : 'No proposals match your filters'}
          description="Create a proposal to track scope, pricing, follow-up dates, and client approval."
          actionLabel="Create Proposal"
          onAction={() => {
            setDraft(createEmptyProposal(settings.business.defaultCurrency));
            setFormOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyField={(p) => p.id}
          compact={settings.preferences.compactTables}
          onRowClick={(p) => setDetailItem(p)}
        />
      )}

      {/* Detail Drawer (All 10 Notion Proposal Template Sections) */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? ''}
        subtitle={
          detailItem
            ? `${clientMap.get(detailItem.clientId)?.company ?? ''} · ${formatCurrency(detailItem.proposedAmount, detailItem.currency)}`
            : undefined
        }
        variant="drawer"
        size="xl"
      >
        {detailItem && (
          <div className="space-y-4">
            {[
              ['1. Proposal Overview', detailItem.overview],
              ['2. Project Scope & Deliverables', detailItem.scopeDeliverables],
              ['3. Timeline & Milestones', detailItem.timelineMilestones],
              ['4. Pricing & Payment Terms', detailItem.pricingTerms],
              ['5. Project Requirements', detailItem.requirements],
              ['6. Terms & Conditions', detailItem.termsConditions],
              ['7. Expected Results', detailItem.expectedResults],
              ['8. Next Steps', detailItem.nextSteps],
              ['9. Follow-up Notes', detailItem.followUpNotes],
              ['10. Final Approval', `${detailItem.finalApproval} ${detailItem.projectId ? `· Linked Project: ${projectMap.get(detailItem.projectId)?.name}` : ''}`],
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
        title={dataset.proposals.some((p) => p.id === draft.id) ? 'Edit Proposal' : 'Create Proposal'}
        subtitle="Preserves all 10 Notion Proposal Tracker template sections"
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Proposal Title *</label>
              <input type="text" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Client *</label>
              <select required value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                <option value="">Select client...</option>
                {dataset.clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Status</label>
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProposalStatus })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                {PROPOSAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Submitted</label>
              <input type="date" value={draft.submissionDate} onChange={(e) => setDraft({ ...draft, submissionDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Follow-up Date</label>
              <input type="date" value={draft.followUpDate} onChange={(e) => setDraft({ ...draft, followUpDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Amount</label>
              <input type="number" min={0} value={draft.proposedAmount} onChange={(e) => setDraft({ ...draft, proposedAmount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Currency</label>
              <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as CurrencyCode })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">1. Proposal Overview</label>
              <textarea rows={2} value={draft.overview} onChange={(e) => setDraft({ ...draft, overview: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">2. Project Scope &amp; Deliverables</label>
              <textarea rows={2} value={draft.scopeDeliverables} onChange={(e) => setDraft({ ...draft, scopeDeliverables: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">3. Timeline &amp; Milestones</label>
              <textarea rows={2} value={draft.timelineMilestones} onChange={(e) => setDraft({ ...draft, timelineMilestones: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">4. Pricing &amp; Payment Terms</label>
              <textarea rows={2} value={draft.pricingTerms} onChange={(e) => setDraft({ ...draft, pricingTerms: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">8. Next Steps</label>
              <textarea rows={2} value={draft.nextSteps} onChange={(e) => setDraft({ ...draft, nextSteps: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">9. Follow-up Notes</label>
              <textarea rows={2} value={draft.followUpNotes} onChange={(e) => setDraft({ ...draft, followUpNotes: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
              Save Proposal
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteProposal(deleteTarget.id)}
        title="Delete Proposal"
        description={`Delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
