import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Download, Edit2, Play, Plus, Search, Square, Trash2 } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CurrencyCode, TimeEntryItem } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, groupAmountsByCurrency, SUPPORTED_CURRENCIES } from '../lib/currencies';
import { formatDisplayDate, formatMinutesToHours, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

function createEmptyTimeEntry(defaultCurrency: CurrencyCode): TimeEntryItem {
  const now = new Date().toISOString();
  return {
    id: `time-${Date.now()}`,
    title: '',
    workDate: REFERENCE_TODAY,
    clientId: '',
    projectId: '',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    billable: true,
    hourlyRate: 0,
    currency: defaultCurrency,
    workOverview: '',
    workCompleted: '',
    resources: '',
    workNotes: '',
    verified: true,
    followUpActions: '',
    finalSummary: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function TimeTrackingPage() {
  const {
    dataset,
    settings,
    upsertTimeEntry,
    deleteTimeEntry,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
  } = useHub();

  const [search, setSearch] = useState('');
  const [billableFilter, setBillableFilter] = useState<'ALL' | 'billable' | 'non'>('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<TimeEntryItem>(() => createEmptyTimeEntry(settings.business.defaultCurrency));
  const [detailItem, setDetailItem] = useState<TimeEntryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntryItem | null>(null);

  // Live session timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTitle, setTimerTitle] = useState('');

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (quickCreate === 'time') {
      setDraft(createEmptyTimeEntry(settings.business.defaultCurrency));
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate, settings.business.defaultCurrency]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.timeEntries.find((t) => t.id === focusedRecordId);
      if (found) {
        setDetailItem(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.timeEntries, setFocusedRecordId]);

  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);
  const projectMap = useMemo(() => new Map(dataset.projects.map((p) => [p.id, p])), [dataset.projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.timeEntries.filter((te) => {
      if (q && !te.title.toLowerCase().includes(q) && !te.workOverview.toLowerCase().includes(q)) return false;
      if (billableFilter === 'billable' && !te.billable) return false;
      if (billableFilter === 'non' && te.billable) return false;
      if (projectFilter !== 'ALL' && te.projectId !== projectFilter) return false;
      return true;
    });
  }, [dataset.timeEntries, search, billableFilter, projectFilter]);

  const totalMinutes = useMemo(() => filtered.reduce((s, t) => s + t.durationMinutes, 0), [filtered]);
  const billableMinutes = useMemo(() => filtered.filter((t) => t.billable).reduce((s, t) => s + t.durationMinutes, 0), [filtered]);
  const earningsByCurrency = useMemo(
    () => groupAmountsByCurrency(filtered.filter((t) => t.billable), (t) => (t.durationMinutes / 60) * t.hourlyRate),
    [filtered]
  );

  const handleStopTimerAndLog = () => {
    setTimerRunning(false);
    const mins = Math.max(15, Math.round(timerSeconds / 60));
    const entry = createEmptyTimeEntry(settings.business.defaultCurrency);
    entry.title = timerTitle.trim() || 'Tracked Work Session';
    entry.durationMinutes = mins;
    setDraft(entry);
    setTimerSeconds(0);
    setTimerTitle('');
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const next: TimeEntryItem = {
      ...draft,
      title: draft.title.trim(),
      clientId: draft.clientId || undefined,
      projectId: draft.projectId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertTimeEntry(next);
    if (detailItem?.id === next.id) setDetailItem(next);
    setFormOpen(false);
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const columns: TableColumn<TimeEntryItem>[] = [
    {
      key: 'title',
      header: 'Work Session',
      sortable: true,
      sortValue: (t) => t.title,
      render: (t) => (
        <div>
          <p className="font-semibold text-[#263247]">{t.title}</p>
          <p className="text-xs text-[#8A91A3]">
            {t.projectId ? projectMap.get(t.projectId)?.name : 'Internal'} · {t.clientId ? clientMap.get(t.clientId)?.company : 'No client'}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date & Window',
      sortable: true,
      sortValue: (t) => t.workDate,
      render: (t) => (
        <div className="text-xs tabular-nums">
          <p className="text-[#263247]">{formatDisplayDate(t.workDate, settings.preferences.dateFormat)}</p>
          <p className="text-[#8A91A3]">{t.startTime} – {t.endTime}</p>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.durationMinutes,
      render: (t) => <span className="font-semibold text-[#263247] tabular-nums">{formatMinutesToHours(t.durationMinutes)}</span>,
    },
    {
      key: 'billable',
      header: 'Status',
      render: (t) => <StatusBadge label={t.billable ? 'Billable' : 'Non-Billable'} />,
    },
    {
      key: 'earnings',
      header: 'Earnings',
      align: 'right',
      render: (t) =>
        t.billable ? (
          <span className="font-semibold text-[#2DAA82] tabular-nums">
            {formatCurrency((t.durationMinutes / 60) * t.hourlyRate, t.currency)}
          </span>
        ) : (
          <span className="text-xs text-[#8A91A3]">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setDraft(structuredClone(t));
              setFormOpen(true);
            }}
            aria-label={`Edit ${t.title}`}
            className="p-1.5 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(t)}
            aria-label={`Delete ${t.title}`}
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
          <h2 className="font-display text-2xl font-bold text-[#263247]">Time Tracker</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Track live sessions or log billable client hours, durations, and hourly earnings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'time-entries-export.csv',
                ['Title', 'Date', 'Start', 'End', 'Minutes', 'Billable', 'Rate', 'Currency'],
                filtered.map((t) => [t.title, t.workDate, t.startTime, t.endTime, t.durationMinutes, t.billable, t.hourlyRate, t.currency])
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
              setDraft(createEmptyTimeEntry(settings.business.defaultCurrency));
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Time</span>
          </button>
        </div>
      </div>

      {/* Live Session Timer Bar */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            value={timerTitle}
            onChange={(e) => setTimerTitle(e.target.value)}
            placeholder="What are you working on right now?"
            className="flex-1 px-3 py-2 text-sm bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <div className="flex items-center justify-between md:justify-end gap-4">
          <span className="font-mono text-lg font-bold text-[#263247] tabular-nums">{formatTimer(timerSeconds)}</span>
          {!timerRunning ? (
            <button
              type="button"
              onClick={() => setTimerRunning(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#2DAA82] hover:bg-[#23906D] rounded-lg cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Timer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopTimerAndLog}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop &amp; Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-6 text-xs">
        <span>
          Total Logged: <strong className="text-[#263247] tabular-nums">{formatMinutesToHours(totalMinutes)}</strong>
        </span>
        <span>
          Billable Hours: <strong className="text-[#39B5B6] tabular-nums">{formatMinutesToHours(billableMinutes)}</strong>
        </span>
        <span>
          Billable Value:{' '}
          {earningsByCurrency.length === 0 ? (
            <strong className="text-[#8A91A3]">—</strong>
          ) : (
            earningsByCurrency.map((g, idx) => (
              <strong key={g.currency} className="text-[#2DAA82] tabular-nums">
                {idx > 0 ? ' · ' : ''}
                {formatCurrency(g.total, g.currency)}
              </strong>
            ))
          )}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search time entries..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
        <select value={billableFilter} onChange={(e) => setBillableFilter(e.target.value as typeof billableFilter)} className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]">
          <option value="ALL">All Entries</option>
          <option value="billable">Billable Only</option>
          <option value="non">Non-Billable Only</option>
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]">
          <option value="ALL">All Projects</option>
          {dataset.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={dataset.timeEntries.length === 0 ? 'No time entries logged yet.' : 'No time entries match your filters'}
          description="Start the live timer above or manually log hours for client and project work."
          actionLabel="Log Time"
          onAction={() => {
            setDraft(createEmptyTimeEntry(settings.business.defaultCurrency));
            setFormOpen(true);
          }}
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyField={(t) => t.id}
          compact={settings.preferences.compactTables}
          onRowClick={(t) => setDetailItem(t)}
        />
      )}

      {/* Detail Drawer (All 10 Notion Time Template Sections) */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? ''}
        subtitle={detailItem ? `${detailItem.workDate} · ${formatMinutesToHours(detailItem.durationMinutes)}` : undefined}
        variant="drawer"
        size="lg"
      >
        {detailItem && (
          <div className="space-y-4">
            {[
              ['1. Work Overview', detailItem.workOverview],
              ['2. Client & Project', `${detailItem.clientId ? clientMap.get(detailItem.clientId)?.company : 'None'} · ${detailItem.projectId ? projectMap.get(detailItem.projectId)?.name : 'Internal'}`],
              ['3. Time Details', `${detailItem.startTime} – ${detailItem.endTime} (${formatMinutesToHours(detailItem.durationMinutes)})`],
              ['4. Earnings Breakdown', detailItem.billable ? `${formatCurrency(detailItem.hourlyRate, detailItem.currency)}/hr → ${formatCurrency((detailItem.durationMinutes / 60) * detailItem.hourlyRate, detailItem.currency)}` : 'Non-billable'],
              ['5. Work Completed', detailItem.workCompleted],
              ['6. Resources & References', detailItem.resources],
              ['7. Work Notes', detailItem.workNotes],
              ['8. Review & Verification', detailItem.verified ? 'Verified' : 'Pending review'],
              ['9. Follow-up Actions', detailItem.followUpActions],
              ['10. Final Summary', detailItem.finalSummary],
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
        title={dataset.timeEntries.some((t) => t.id === draft.id) ? 'Edit Time Entry' : 'Log Time Entry'}
        subtitle="Preserves all 10 Notion Time Tracker template sections"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Work Title *</label>
            <input type="text" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Work Date</label>
              <input type="date" value={draft.workDate} onChange={(e) => setDraft({ ...draft, workDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Start Time</label>
              <input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">End Time</label>
              <input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Duration (mins)</label>
              <input type="number" min={1} value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Project</label>
              <select
                value={draft.projectId ?? ''}
                onChange={(e) => {
                  const pid = e.target.value;
                  const proj = projectMap.get(pid);
                  setDraft({ ...draft, projectId: pid, clientId: proj?.clientId ?? draft.clientId, currency: proj?.currency ?? draft.currency });
                }}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                <option value="">Internal / None</option>
                {dataset.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Client</label>
              <select value={draft.clientId ?? ''} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                <option value="">None</option>
                {dataset.clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-2 text-xs font-medium text-[#263247] pb-2 cursor-pointer">
              <input type="checkbox" checked={draft.billable} onChange={(e) => setDraft({ ...draft, billable: e.target.checked })} />
              <span>Billable Work</span>
            </label>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Hourly Rate</label>
              <input type="number" min={0} disabled={!draft.billable} value={draft.hourlyRate} onChange={(e) => setDraft({ ...draft, hourlyRate: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Currency</label>
              <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as CurrencyCode })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white">
                {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Work Overview &amp; Completed Notes</label>
            <textarea rows={2} value={draft.workOverview} onChange={(e) => setDraft({ ...draft, workOverview: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9F1]">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
              Save Time Entry
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteTimeEntry(deleteTarget.id)}
        title="Delete Time Entry"
        description={`Delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
