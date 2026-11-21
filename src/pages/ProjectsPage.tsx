import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Edit2,
  FolderKanban,
  GanttChart,
  Info,
  Kanban,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CurrencyCode, ProjectItem, ProjectStatus } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { computeProjectFinancials, formatCurrency, SUPPORTED_CURRENCIES } from '../lib/currencies';
import { formatDisplayDate, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

const STATUS_OPTIONS: ProjectStatus[] = ['Not Started', 'In Progress', 'On Hold', 'Completed'];

function createEmptyProject(defaultCurrency: CurrencyCode): ProjectItem {
  const now = new Date().toISOString();
  return {
    id: `proj-${Date.now()}`,
    name: '',
    status: 'Not Started',
    startDate: REFERENCE_TODAY,
    endDate: REFERENCE_TODAY,
    progress: 0,
    clientId: '',
    budget: 0,
    currency: defaultCurrency,
    overview: '',
    scopeDeliverables: '',
    milestonesTimeline: '',
    tasksActionPlan: '',
    clientRequirements: '',
    resourcesFiles: '',
    budgetPlanning: '',
    challengesUpdates: '',
    completionHandover: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function ProjectsPage() {
  const {
    dataset,
    settings,
    upsertProject,
    deleteProject,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
    navigateToRecord,
  } = useHub();

  const [viewMode, setViewMode] = useState<'table' | 'board' | 'timeline'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectItem>(() => createEmptyProject(settings.business.defaultCurrency));
  const [detailProject, setDetailProject] = useState<ProjectItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'project') {
      setDraft(createEmptyProject(settings.business.defaultCurrency));
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.projects.find((p) => p.id === focusedRecordId);
      if (found) {
        setDetailProject(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.projects, setFocusedRecordId]);

  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);

  // Count transactions not linked to any project so user understands project vs business totals (Part 4.2)
  const unlinkedTxCount = useMemo(() => {
    const inc = dataset.incomes.filter((i) => !i.projectId).length;
    const exp = dataset.expenses.filter((e) => !e.projectId).length;
    return inc + exp;
  }, [dataset.incomes, dataset.expenses]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.overview.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (clientFilter !== 'ALL' && p.clientId !== clientFilter) return false;
      return true;
    });
  }, [dataset.projects, search, statusFilter, clientFilter]);

  const handleOpenEdit = (proj: ProjectItem) => {
    setDraft(structuredClone(proj));
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const next: ProjectItem = {
      ...draft,
      name: draft.name.trim(),
      clientId: draft.clientId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertProject(next);
    if (detailProject?.id === next.id) setDetailProject(next);
    setFormOpen(false);
  };

  const columns: TableColumn<ProjectItem>[] = [
    {
      key: 'name',
      header: 'Project',
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="min-w-0">
          <p className="font-semibold text-[#263247]">{p.name}</p>
          <p className="text-xs text-[#8A91A3] mt-0.5">
            {p.clientId ? clientMap.get(p.clientId)?.company || clientMap.get(p.clientId)?.name : 'Internal / No client'}
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
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (p) => p.progress,
      render: (p) => (
        <div className="w-28">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-[#263247] tabular-nums">{p.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#E7E9F1] rounded-full overflow-hidden">
            <div className="h-full bg-[#7853E8] rounded-full" style={{ width: `${p.progress}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: 'timeline',
      header: 'Timeline',
      render: (p) => (
        <span className="text-xs text-[#4E596F] tabular-nums whitespace-nowrap">
          {formatDisplayDate(p.startDate, settings.preferences.dateFormat)} –{' '}
          {formatDisplayDate(p.endDate, settings.preferences.dateFormat)}
        </span>
      ),
    },
    {
      key: 'profit',
      header: 'Net Profit (Rollup)',
      align: 'right',
      render: (p) => {
        const summaries = computeProjectFinancials(p.id, dataset.incomes, dataset.expenses);
        if (summaries.length === 0) return <span className="text-xs text-[#8A91A3]">No linked tx</span>;
        return (
          <div className="space-y-0.5">
            {summaries.map((s) => (
              <p
                key={s.currency}
                className={`text-xs font-semibold tabular-nums ${s.netProfit >= 0 ? 'text-[#2DAA82]' : 'text-[#DC2626]'}`}
              >
                {formatCurrency(s.netProfit, s.currency)}
              </p>
            ))}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleOpenEdit(p)}
            aria-label={`Edit ${p.name}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(p)}
            aria-label={`Delete ${p.name}`}
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
          <h2 className="font-display text-2xl font-bold text-[#263247]">Project Manager</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Manage deliverables, milestones, related tasks, and Notion rollup finances (Income − Expenses = Net Profit).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'projects-export.csv',
                ['Name', 'Status', 'Progress %', 'Start Date', 'End Date', 'Budget', 'Currency'],
                filteredProjects.map((p) => [p.name, p.status, p.progress, p.startDate, p.endDate, p.budget, p.currency])
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
              setDraft(createEmptyProject(settings.business.defaultCurrency));
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {unlinkedTxCount > 0 && (
        <div className="bg-white border border-[#E7E9F1] rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-[#4E596F]">
          <Info className="w-4 h-4 text-[#78A7E8] shrink-0" />
          <span>
            Project financial rollups include only Income &amp; Expense records linked to that project. Currently{' '}
            <strong className="text-[#263247]">{unlinkedTxCount}</strong> general business transactions are unlinked and appear in workspace totals only.
          </span>
        </div>
      )}

      {/* Filters & View Switcher */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
            />
          </div>

          <select
            aria-label="Filter projects by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            aria-label="Filter projects by client"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="ALL">All Clients</option>
            {dataset.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company || c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F4F5FC] rounded-lg self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === 'table' ? 'bg-white text-[#263247] shadow-sm' : 'text-[#8A91A3]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === 'board' ? 'bg-white text-[#263247] shadow-sm' : 'text-[#8A91A3]'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Board</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === 'timeline' ? 'bg-white text-[#263247] shadow-sm' : 'text-[#8A91A3]'
            }`}
          >
            <GanttChart className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={dataset.projects.length === 0 ? 'No projects yet.' : 'No projects match your filters'}
          description="Add a new project to track deliverables, related tasks, and project-level profitability."
          actionLabel="Add Project"
          onAction={() => {
            setDraft(createEmptyProject(settings.business.defaultCurrency));
            setFormOpen(true);
          }}
        />
      ) : viewMode === 'table' ? (
        <DataTable
          data={filteredProjects}
          columns={columns}
          keyField={(p) => p.id}
          compact={settings.preferences.compactTables}
          onRowClick={(p) => setDetailProject(p)}
        />
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_OPTIONS.map((status) => {
            const list = filteredProjects.filter((p) => p.status === status);
            return (
              <div key={status} className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E7E9F1]">
                  <StatusBadge label={status} />
                  <span className="text-xs font-semibold text-[#8A91A3] tabular-nums">{list.length}</span>
                </div>
                <div className="space-y-3">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setDetailProject(p)}
                      className="p-3 rounded-lg border border-[#E7E9F1] bg-[#F8F9FD] hover:border-[#7853E8] cursor-pointer space-y-2"
                    >
                      <p className="text-sm font-semibold text-[#263247]">{p.name}</p>
                      <p className="text-xs text-[#8A91A3]">
                        {p.clientId ? clientMap.get(p.clientId)?.company : 'Internal'}
                      </p>
                      <div className="w-full h-1.5 bg-[#E7E9F1] rounded-full overflow-hidden">
                        <div className="h-full bg-[#7853E8]" style={{ width: `${p.progress}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#8A91A3] tabular-nums">
                        <span>{p.progress}%</span>
                        <span>Due {formatDisplayDate(p.endDate, settings.preferences.dateFormat)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#263247]">Project Timeline Overview</h3>
          <div className="space-y-3">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => setDetailProject(p)}
                className="p-3.5 rounded-xl border border-[#E7E9F1] hover:bg-[#F4F5FC] cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 sm:w-64">
                  <p className="text-sm font-semibold text-[#263247] truncate">{p.name}</p>
                  <p className="text-xs text-[#8A91A3] tabular-nums">
                    {formatDisplayDate(p.startDate, settings.preferences.dateFormat)} →{' '}
                    {formatDisplayDate(p.endDate, settings.preferences.dateFormat)}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="w-full h-3 bg-[#F4F5FC] rounded-full overflow-hidden border border-[#E7E9F1]">
                    <div
                      className="h-full rounded-full bg-[#7853E8]"
                      style={{ width: `${Math.max(8, p.progress)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold tabular-nums text-[#263247]">{p.progress}%</span>
                  <StatusBadge label={p.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Detail Drawer (All 9 Notion Template Sections + Rollup Financials) */}
      <Modal
        open={!!detailProject}
        onClose={() => setDetailProject(null)}
        title={detailProject?.name ?? ''}
        subtitle={
          detailProject?.clientId
            ? `Client: ${clientMap.get(detailProject.clientId)?.company ?? clientMap.get(detailProject.clientId)?.name}`
            : 'Internal Project'
        }
        variant="drawer"
        size="xl"
        headerActions={
          detailProject && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenEdit(detailProject)}
                className="px-3 py-1.5 text-xs font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(detailProject);
                  setDetailProject(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#DC2626] border border-[#DC2626]/20 rounded-lg hover:bg-[#DC2626]/10 cursor-pointer"
              >
                Delete
              </button>
            </div>
          )
        }
      >
        {detailProject && (
          <div className="space-y-6">
            {/* Project Rollup Financial Summary */}
            <div className="bg-[#F8F9FD] border border-[#E7E9F1] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-[#263247]">Project Financial Rollup (Notion Formula: Income − Expenses)</h4>
                <span className="text-xs text-[#8A91A3] tabular-nums">
                  Budget: {formatCurrency(detailProject.budget, detailProject.currency)}
                </span>
              </div>
              {(() => {
                const summaries = computeProjectFinancials(detailProject.id, dataset.incomes, dataset.expenses);
                if (summaries.length === 0) {
                  return <p className="text-xs text-[#8A91A3]">No income or expense records linked to this project yet.</p>;
                }
                return (
                  <div className="space-y-2">
                    {summaries.map((s) => (
                      <div key={s.currency} className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-[#E7E9F1]">
                        <div>
                          <p className="text-[11px] text-[#8A91A3]">Total Income ({s.currency})</p>
                          <p className="text-sm font-bold text-[#263247] tabular-nums">{formatCurrency(s.totalIncome, s.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#8A91A3]">Total Expenses ({s.currency})</p>
                          <p className="text-sm font-bold text-[#263247] tabular-nums">{formatCurrency(s.totalExpenses, s.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#8A91A3]">Net Profit ({s.currency})</p>
                          <p className={`text-sm font-bold tabular-nums ${s.netProfit >= 0 ? 'text-[#2DAA82]' : 'text-[#DC2626]'}`}>
                            {formatCurrency(s.netProfit, s.currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Related Tasks quick list */}
            <div>
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider mb-2">
                Linked Tasks ({dataset.tasks.filter((t) => t.projectId === detailProject.id).length})
              </h4>
              <div className="space-y-1.5">
                {dataset.tasks
                  .filter((t) => t.projectId === detailProject.id)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setDetailProject(null);
                        navigateToRecord('tasks', t.id);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg border border-[#E7E9F1] hover:bg-[#F4F5FC] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-[#263247]">{t.title}</span>
                      <StatusBadge label={t.status} />
                    </button>
                  ))}
              </div>
            </div>

            {/* All 9 Notion Project Template Sections */}
            {[
              ['1. Project Overview', detailProject.overview],
              ['2. Project Scope & Deliverables', detailProject.scopeDeliverables],
              ['3. Milestones & Timeline', detailProject.milestonesTimeline],
              ['4. Tasks & Action Plan', detailProject.tasksActionPlan],
              ['5. Client Requirements', detailProject.clientRequirements],
              ['6. Resources & Project Files', detailProject.resourcesFiles],
              ['7. Budget & Financial Planning', detailProject.budgetPlanning],
              ['8. Project Challenges & Updates', detailProject.challengesUpdates],
              ['9. Project Completion & Handover', detailProject.completionHandover],
            ].map(([label, content]) => (
              <section key={label} className="border-t border-[#E7E9F1] pt-3.5 space-y-1">
                <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">{label}</h4>
                <p className="text-sm text-[#263247] whitespace-pre-line leading-relaxed">{content || '—'}</p>
              </section>
            ))}
          </div>
        )}
      </Modal>

      {/* Create / Edit Project Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={dataset.projects.some((p) => p.id === draft.id) ? 'Edit Project' : 'Create Project'}
        subtitle="Preserves all 9 Notion Project Manager template sections"
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Client</label>
              <select
                value={draft.clientId ?? ''}
                onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                <option value="">Internal / Unassigned</option>
                {dataset.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company || c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Progress (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.progress}
                onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Start Date</label>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">End Date</label>
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Budget ({draft.currency})</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min={0}
                  value={draft.budget}
                  onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums"
                />
                <select
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value as CurrencyCode })}
                  className="px-2 py-2 text-xs border border-[#E7E9F1] rounded-lg bg-white"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">1. Project Overview</label>
              <textarea
                rows={2}
                value={draft.overview}
                onChange={(e) => setDraft({ ...draft, overview: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">2. Project Scope &amp; Deliverables</label>
              <textarea
                rows={2}
                value={draft.scopeDeliverables}
                onChange={(e) => setDraft({ ...draft, scopeDeliverables: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">3. Milestones &amp; Timeline</label>
              <textarea
                rows={2}
                value={draft.milestonesTimeline}
                onChange={(e) => setDraft({ ...draft, milestonesTimeline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">4. Tasks &amp; Action Plan</label>
              <textarea
                rows={2}
                value={draft.tasksActionPlan}
                onChange={(e) => setDraft({ ...draft, tasksActionPlan: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">5. Client Requirements</label>
              <textarea
                rows={2}
                value={draft.clientRequirements}
                onChange={(e) => setDraft({ ...draft, clientRequirements: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">6. Resources &amp; Project Files</label>
              <textarea
                rows={2}
                value={draft.resourcesFiles}
                onChange={(e) => setDraft({ ...draft, resourcesFiles: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">7. Budget &amp; Financial Planning</label>
              <textarea
                rows={2}
                value={draft.budgetPlanning}
                onChange={(e) => setDraft({ ...draft, budgetPlanning: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">8. Challenges &amp; Updates</label>
              <textarea
                rows={2}
                value={draft.challengesUpdates}
                onChange={(e) => setDraft({ ...draft, challengesUpdates: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">9. Project Completion &amp; Handover</label>
            <textarea
              rows={2}
              value={draft.completionHandover}
              onChange={(e) => setDraft({ ...draft, completionHandover: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer"
            >
              Save Project
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteProject(deleteTarget.id)}
        title="Delete Project"
        description={`Delete "${deleteTarget?.name}"? Linked tasks, invoices, and financial entries will remain intact but unlinked.`}
      />
    </div>
  );
}
