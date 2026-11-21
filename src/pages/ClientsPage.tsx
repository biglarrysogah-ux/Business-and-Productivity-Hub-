import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit2, Mail, MapPin, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ClientItem, ClientStatus, CurrencyCode } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, getInvoiceTotal, SUPPORTED_CURRENCIES } from '../lib/currencies';
import { downloadCSV } from '../lib/csvExport';

const CLIENT_STATUSES: ClientStatus[] = ['Lead', 'Active', 'Retainer', 'Completed', 'Inactive'];

function createEmptyClient(defaultCurrency: CurrencyCode): ClientItem {
  const now = new Date().toISOString();
  return {
    id: `cli-${Date.now()}`,
    name: '',
    company: '',
    email: '',
    phone: '',
    location: '',
    status: 'Active',
    preferredCurrency: defaultCurrency,
    overview: '',
    requirements: '',
    servicesProvided: '',
    communicationMeetings: '',
    agreementsExpectations: '',
    documentsResources: '',
    relationshipNotes: '',
    reviewSummary: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function ClientsPage() {
  const {
    dataset,
    settings,
    upsertClient,
    deleteClient,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
    navigateToRecord,
  } = useHub();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ClientItem>(() => createEmptyClient(settings.business.defaultCurrency));
  const [detailClient, setDetailClient] = useState<ClientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'client') {
      setDraft(createEmptyClient(settings.business.defaultCurrency));
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.clients.find((c) => c.id === focusedRecordId);
      if (found) {
        setDetailClient(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.clients, setFocusedRecordId]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.clients.filter((c) => {
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.company.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      return true;
    });
  }, [dataset.clients, search, statusFilter]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const next: ClientItem = {
      ...draft,
      name: draft.name.trim(),
      company: draft.company.trim(),
      updatedAt: new Date().toISOString(),
    };
    upsertClient(next);
    if (detailClient?.id === next.id) setDetailClient(next);
    setFormOpen(false);
  };

  const columns: TableColumn<ClientItem>[] = [
    {
      key: 'client',
      header: 'Client & Company',
      sortable: true,
      sortValue: (c) => c.company || c.name,
      render: (c) => (
        <div>
          <p className="font-semibold text-[#263247]">{c.company || c.name}</p>
          <p className="text-xs text-[#8A91A3]">{c.name}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c) => (
        <div className="text-xs text-[#4E596F] space-y-0.5">
          <p>{c.email || '—'}</p>
          <p className="text-[#8A91A3]">{c.location || c.phone || ''}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (c) => c.status,
      render: (c) => <StatusBadge label={c.status} />,
    },
    {
      key: 'projects',
      header: 'Projects',
      align: 'right',
      render: (c) => (
        <span className="text-xs font-semibold tabular-nums text-[#263247]">
          {dataset.projects.filter((p) => p.clientId === c.id).length}
        </span>
      ),
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (c) => <span className="text-xs font-mono text-[#4E596F]">{c.preferredCurrency}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setDraft(structuredClone(c));
              setFormOpen(true);
            }}
            aria-label={`Edit ${c.name}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(c)}
            aria-label={`Delete ${c.name}`}
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
          <h2 className="font-display text-2xl font-bold text-[#263247]">Client Manager</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Central directory of client relationships, agreements, communications, and linked engagements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'clients-export.csv',
                ['Company', 'Contact Name', 'Email', 'Phone', 'Location', 'Status', 'Currency'],
                filteredClients.map((c) => [c.company, c.name, c.email, c.phone, c.location, c.status, c.preferredCurrency])
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
              setDraft(createEmptyClient(settings.business.defaultCurrency));
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, company, or email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <select
          aria-label="Filter clients by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
        >
          <option value="ALL">All Statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={dataset.clients.length === 0 ? 'No clients added.' : 'No clients match your filters'}
          description="Add your first client to connect projects, invoices, proposals, and communication records."
          actionLabel="Add Client"
          onAction={() => {
            setDraft(createEmptyClient(settings.business.defaultCurrency));
            setFormOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={filteredClients}
          columns={columns}
          keyField={(c) => c.id}
          compact={settings.preferences.compactTables}
          onRowClick={(c) => setDetailClient(c)}
        />
      )}

      {/* Client Detail Drawer (All 8 Notion Template Sections + Related Records) */}
      <Modal
        open={!!detailClient}
        onClose={() => setDetailClient(null)}
        title={detailClient?.company || detailClient?.name || ''}
        subtitle={detailClient ? `${detailClient.name} · ${detailClient.status}` : undefined}
        variant="drawer"
        size="xl"
        headerActions={
          detailClient && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDraft(structuredClone(detailClient));
                  setFormOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(detailClient);
                  setDetailClient(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#DC2626] border border-[#DC2626]/20 rounded-lg hover:bg-[#DC2626]/10 cursor-pointer"
              >
                Delete
              </button>
            </div>
          )
        }
      >
        {detailClient && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F8F9FD] p-4 rounded-xl border border-[#E7E9F1] text-xs">
              <div className="flex items-center gap-2 text-[#263247]">
                <Mail className="w-4 h-4 text-[#7853E8]" />
                <span className="truncate">{detailClient.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#263247]">
                <Phone className="w-4 h-4 text-[#39B5B6]" />
                <span>{detailClient.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-[#263247]">
                <MapPin className="w-4 h-4 text-[#E9AD58]" />
                <span>{detailClient.location || '—'}</span>
              </div>
            </div>

            {/* Related Records */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-[#E7E9F1]">
                <p className="text-xs font-semibold text-[#8A91A3] mb-2">
                  Related Projects ({dataset.projects.filter((p) => p.clientId === detailClient.id).length})
                </p>
                <div className="space-y-1.5">
                  {dataset.projects
                    .filter((p) => p.clientId === detailClient.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setDetailClient(null);
                          navigateToRecord('projects', p.id);
                        }}
                        className="block w-full text-left text-xs font-medium text-[#7853E8] hover:underline truncate cursor-pointer"
                      >
                        {p.name} ({p.status})
                      </button>
                    ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E7E9F1]">
                <p className="text-xs font-semibold text-[#8A91A3] mb-2">
                  Related Invoices ({dataset.invoices.filter((i) => i.clientId === detailClient.id).length})
                </p>
                <div className="space-y-1.5">
                  {dataset.invoices
                    .filter((i) => i.clientId === detailClient.id)
                    .map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => {
                          setDetailClient(null);
                          navigateToRecord('invoices', inv.id);
                        }}
                        className="block w-full text-left text-xs font-medium text-[#7853E8] hover:underline truncate cursor-pointer"
                      >
                        {inv.invoiceNumber} · {formatCurrency(getInvoiceTotal(inv), inv.currency)}
                      </button>
                    ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E7E9F1]">
                <p className="text-xs font-semibold text-[#8A91A3] mb-2">
                  Related Proposals ({dataset.proposals.filter((pr) => pr.clientId === detailClient.id).length})
                </p>
                <div className="space-y-1.5">
                  {dataset.proposals
                    .filter((pr) => pr.clientId === detailClient.id)
                    .map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => {
                          setDetailClient(null);
                          navigateToRecord('proposals', pr.id);
                        }}
                        className="block w-full text-left text-xs font-medium text-[#7853E8] hover:underline truncate cursor-pointer"
                      >
                        {pr.title} ({pr.status})
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* All 8 Notion Client Template Sections */}
            {[
              ['1. Client Overview', detailClient.overview],
              ['2. Client Requirements', detailClient.requirements],
              ['3. Services Provided', detailClient.servicesProvided],
              ['4. Communication & Meetings', detailClient.communicationMeetings],
              ['5. Agreements & Expectations', detailClient.agreementsExpectations],
              ['6. Client Documents & Resources', detailClient.documentsResources],
              ['7. Client Relationship Notes', detailClient.relationshipNotes],
              ['8. Client Review & Relationship Summary', detailClient.reviewSummary],
            ].map(([label, content]) => (
              <section key={label} className="border-t border-[#E7E9F1] pt-3.5 space-y-1">
                <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">{label}</h4>
                <p className="text-sm text-[#263247] whitespace-pre-line leading-relaxed">{content || '—'}</p>
              </section>
            ))}
          </div>
        )}
      </Modal>

      {/* Create / Edit Client Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={dataset.clients.some((c) => c.id === draft.id) ? 'Edit Client' : 'Add Client'}
        subtitle="Preserves all 8 Notion Client Manager template sections"
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Contact Name *</label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Company / Organization</label>
              <input
                type="text"
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#263247] mb-1">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ClientStatus })}
                  className="w-full px-2.5 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#263247] mb-1">Currency</label>
                <select
                  value={draft.preferredCurrency}
                  onChange={(e) => setDraft({ ...draft, preferredCurrency: e.target.value as CurrencyCode })}
                  className="w-full px-2.5 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Email</label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Phone</label>
              <input
                type="text"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Location</label>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">1. Client Overview</label>
              <textarea rows={2} value={draft.overview} onChange={(e) => setDraft({ ...draft, overview: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">2. Client Requirements</label>
              <textarea rows={2} value={draft.requirements} onChange={(e) => setDraft({ ...draft, requirements: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">3. Services Provided</label>
              <textarea rows={2} value={draft.servicesProvided} onChange={(e) => setDraft({ ...draft, servicesProvided: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">4. Communication &amp; Meetings</label>
              <textarea rows={2} value={draft.communicationMeetings} onChange={(e) => setDraft({ ...draft, communicationMeetings: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">5. Agreements &amp; Expectations</label>
              <textarea rows={2} value={draft.agreementsExpectations} onChange={(e) => setDraft({ ...draft, agreementsExpectations: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">6. Client Documents &amp; Resources</label>
              <textarea rows={2} value={draft.documentsResources} onChange={(e) => setDraft({ ...draft, documentsResources: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">7. Client Relationship Notes</label>
              <textarea rows={2} value={draft.relationshipNotes} onChange={(e) => setDraft({ ...draft, relationshipNotes: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">8. Client Review &amp; Relationship Summary</label>
              <textarea rows={2} value={draft.reviewSummary} onChange={(e) => setDraft({ ...draft, reviewSummary: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
              Save Client
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteClient(deleteTarget.id)}
        title="Delete Client"
        description={`Delete "${deleteTarget?.company || deleteTarget?.name}" from Client Manager?`}
      />
    </div>
  );
}
