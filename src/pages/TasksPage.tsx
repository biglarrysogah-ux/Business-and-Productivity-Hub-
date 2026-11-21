import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  Download,
  Edit2,
  Kanban,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ChecklistItem, TaskItem, TaskPriority, TaskStatus } from '../types/business';
import { DataTable, TableColumn } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDisplayDate, formatMinutesToHours, REFERENCE_TODAY } from '../lib/dateUtils';
import { downloadCSV } from '../lib/csvExport';

const STATUS_OPTIONS: TaskStatus[] = ['Not Started', 'In Progress', 'Waiting', 'Completed'];
const PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

function createEmptyTask(): TaskItem {
  const now = new Date().toISOString();
  return {
    id: `task-${Date.now()}`,
    title: '',
    status: 'Not Started',
    priority: 'Medium',
    dueDate: REFERENCE_TODAY,
    projectId: '',
    clientId: '',
    overview: '',
    checklist: [],
    estimatedMinutes: 60,
    actualMinutes: 0,
    resources: '',
    completionNotes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function TasksPage() {
  const {
    dataset,
    settings,
    upsertTask,
    deleteTask,
    toggleTaskComplete,
    focusedRecordId,
    setFocusedRecordId,
    quickCreate,
    openQuickCreate,
    navigateToRecord,
  } = useHub();

  const [viewMode, setViewMode] = useState<'table' | 'board' | 'calendar'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'overdue' | 'today' | 'upcoming'>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<TaskItem>(createEmptyTask);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [formError, setFormError] = useState('');

  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);

  useEffect(() => {
    if (quickCreate === 'task') {
      setDraft(createEmptyTask());
      setFormError('');
      setFormOpen(true);
      openQuickCreate(null);
    }
  }, [quickCreate, openQuickCreate]);

  useEffect(() => {
    if (focusedRecordId) {
      const found = dataset.tasks.find((t) => t.id === focusedRecordId);
      if (found) {
        setDetailTask(found);
        setFocusedRecordId(null);
      }
    }
  }, [focusedRecordId, dataset.tasks, setFocusedRecordId]);

  const projectMap = useMemo(() => new Map(dataset.projects.map((p) => [p.id, p])), [dataset.projects]);
  const clientMap = useMemo(() => new Map(dataset.clients.map((c) => [c.id, c])), [dataset.clients]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.overview.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      if (dueFilter === 'overdue' && !(t.status !== 'Completed' && t.dueDate < REFERENCE_TODAY)) return false;
      if (dueFilter === 'today' && t.dueDate !== REFERENCE_TODAY) return false;
      if (dueFilter === 'upcoming' && !(t.dueDate > REFERENCE_TODAY && t.status !== 'Completed')) return false;
      return true;
    });
  }, [dataset.tasks, search, statusFilter, priorityFilter, projectFilter, dueFilter]);

  const handleOpenCreate = () => {
    setDraft(createEmptyTask());
    setFormError('');
    setFormOpen(true);
  };

  const handleOpenEdit = (task: TaskItem) => {
    setDraft(structuredClone(task));
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setFormError('Task title is required.');
      return;
    }
    const next: TaskItem = {
      ...draft,
      title: draft.title.trim(),
      projectId: draft.projectId || undefined,
      clientId: draft.clientId || undefined,
      updatedAt: new Date().toISOString(),
    };
    upsertTask(next);
    if (detailTask?.id === next.id) setDetailTask(next);
    setFormOpen(false);
  };

  const handleAddChecklist = () => {
    if (!newCheckItem.trim()) return;
    const item: ChecklistItem = { id: `chk-${Date.now()}`, label: newCheckItem.trim(), done: false };
    setDraft((d) => ({ ...d, checklist: [...d.checklist, item] }));
    setNewCheckItem('');
  };

  const toggleDetailChecklist = (task: TaskItem, checkId: string) => {
    const updated: TaskItem = {
      ...task,
      checklist: task.checklist.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c)),
      updatedAt: new Date().toISOString(),
    };
    upsertTask(updated);
    setDetailTask(updated);
  };

  const columns: TableColumn<TaskItem>[] = [
    {
      key: 'complete',
      header: '',
      widthClass: 'w-10',
      render: (t) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleTaskComplete(t.id);
          }}
          aria-label={t.status === 'Completed' ? 'Mark task incomplete' : 'Mark task complete'}
          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
            t.status === 'Completed'
              ? 'bg-[#2DAA82] border-[#2DAA82] text-white'
              : 'border-[#C9CEDE] hover:border-[#7853E8]'
          }`}
        >
          {t.status === 'Completed' && <Check className="w-3.5 h-3.5" />}
        </button>
      ),
    },
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      sortValue: (t) => t.title,
      render: (t) => (
        <div className="min-w-0">
          <p className={`font-medium ${t.status === 'Completed' ? 'line-through text-[#8A91A3]' : 'text-[#263247]'}`}>
            {t.title}
          </p>
          {t.checklist.length > 0 && (
            <p className="text-xs text-[#8A91A3] mt-0.5 tabular-nums">
              {t.checklist.filter((c) => c.done).length}/{t.checklist.length} checklist items
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (t) => t.status,
      render: (t) => <StatusBadge label={t.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      sortValue: (t) => t.priority,
      render: (t) => <StatusBadge label={t.priority} />,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      sortValue: (t) => t.dueDate,
      render: (t) => {
        const overdue = t.status !== 'Completed' && t.dueDate && t.dueDate < REFERENCE_TODAY;
        return (
          <span className={`tabular-nums text-xs font-medium ${overdue ? 'text-[#DC2626]' : 'text-[#4E596F]'}`}>
            {formatDisplayDate(t.dueDate, settings.preferences.dateFormat)}
            {overdue ? ' (Overdue)' : ''}
          </span>
        );
      },
    },
    {
      key: 'project',
      header: 'Project',
      render: (t) => {
        const proj = t.projectId ? projectMap.get(t.projectId) : undefined;
        return proj ? (
          <span className="text-xs font-medium text-[#7853E8]">{proj.name}</span>
        ) : (
          <span className="text-xs text-[#8A91A3]">—</span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleOpenEdit(t)}
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

  // Simple Calendar month grouping for Calendar View
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    filteredTasks.forEach((t) => {
      const key = t.dueDate || 'Unscheduled';
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#263247]">Task Manager</h2>
          <p className="text-sm text-[#8A91A3] mt-0.5">
            Organize daily action items, checklists, time planning, and project deliverables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSV(
                'tasks-export.csv',
                ['Title', 'Status', 'Priority', 'Due Date', 'Project', 'Estimated', 'Actual'],
                filteredTasks.map((t) => [
                  t.title,
                  t.status,
                  t.priority,
                  t.dueDate,
                  t.projectId ? projectMap.get(t.projectId)?.name ?? '' : '',
                  formatMinutesToHours(t.estimatedMinutes),
                  formatMinutesToHours(t.actualMinutes),
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
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Filters + View Switcher */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
            />
          </div>

          <select
            aria-label="Filter by status"
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
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="ALL">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            aria-label="Filter by due date"
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}
            className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="ALL">All Due Dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming</option>
          </select>

          <select
            aria-label="Filter by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F4F5FC] border border-[#E7E9F1] rounded-lg text-[#263247]"
          >
            <option value="ALL">All Projects</option>
            {dataset.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
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
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              viewMode === 'calendar' ? 'bg-white text-[#263247] shadow-sm' : 'text-[#8A91A3]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {/* Content View */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={dataset.tasks.length === 0 ? 'No tasks yet.' : 'No tasks match your filters'}
          description="Create a new task or adjust your status, priority, or due-date filters."
          actionLabel="Add Task"
          onAction={handleOpenCreate}
        />
      ) : viewMode === 'table' ? (
        <DataTable
          data={filteredTasks}
          columns={columns}
          keyField={(t) => t.id}
          compact={settings.preferences.compactTables}
          onRowClick={(t) => setDetailTask(t)}
        />
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_OPTIONS.map((status) => {
            const colTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <div key={status} className="bg-white border border-[#E7E9F1] rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E7E9F1]">
                  <StatusBadge label={status} />
                  <span className="text-xs font-semibold text-[#8A91A3] tabular-nums">{colTasks.length}</span>
                </div>
                <div className="space-y-2.5 flex-1">
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-[#8A91A3] text-center py-6">No tasks</p>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setDetailTask(t)}
                        className="p-3 rounded-lg border border-[#E7E9F1] bg-[#F8F9FD] hover:border-[#7853E8] transition-colors cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-[#263247] leading-snug">{t.title}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#8A91A3]">
                          <StatusBadge label={t.priority} />
                          <span className="tabular-nums">{formatDisplayDate(t.dueDate, settings.preferences.dateFormat)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E7E9F1] rounded-xl divide-y divide-[#E7E9F1]">
          {tasksByDate.map(([dateKey, items]) => (
            <div key={dateKey} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-40 shrink-0">
                <p className="text-sm font-semibold text-[#263247] tabular-nums">
                  {dateKey === 'Unscheduled' ? dateKey : formatDisplayDate(dateKey, settings.preferences.dateFormat)}
                </p>
                <p className="text-xs text-[#8A91A3] tabular-nums">{items.length} tasks</p>
              </div>
              <div className="flex-1 space-y-2">
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDetailTask(t)}
                    className="w-full text-left p-3 rounded-lg border border-[#E7E9F1] hover:bg-[#F4F5FC] flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-[#263247]">{t.title}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={t.status} />
                      <StatusBadge label={t.priority} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail Drawer (All 5 Notion Template Sections) */}
      <Modal
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        title={detailTask?.title ?? ''}
        subtitle={detailTask ? `Status: ${detailTask.status} · Priority: ${detailTask.priority}` : undefined}
        variant="drawer"
        headerActions={
          detailTask && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handleOpenEdit(detailTask);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#263247] border border-[#E7E9F1] rounded-lg hover:bg-[#F4F5FC] cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(detailTask);
                  setDetailTask(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#DC2626] border border-[#DC2626]/20 rounded-lg hover:bg-[#DC2626]/10 cursor-pointer"
              >
                Delete
              </button>
            </div>
          )
        }
      >
        {detailTask && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#F4F5FC]">
                <p className="text-[11px] text-[#8A91A3]">Status</p>
                <div className="mt-1"><StatusBadge label={detailTask.status} /></div>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F5FC]">
                <p className="text-[11px] text-[#8A91A3]">Priority</p>
                <div className="mt-1"><StatusBadge label={detailTask.priority} /></div>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F5FC]">
                <p className="text-[11px] text-[#8A91A3]">Due Date</p>
                <p className="text-xs font-semibold text-[#263247] mt-1.5 tabular-nums">
                  {formatDisplayDate(detailTask.dueDate, settings.preferences.dateFormat)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#F4F5FC]">
                <p className="text-[11px] text-[#8A91A3]">Project / Client</p>
                {detailTask.projectId && projectMap.get(detailTask.projectId) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = detailTask.projectId!;
                      setDetailTask(null);
                      navigateToRecord('projects', pid);
                    }}
                    className="text-xs font-semibold text-[#7853E8] hover:underline mt-1.5 text-left truncate block cursor-pointer"
                  >
                    {projectMap.get(detailTask.projectId)!.name}
                  </button>
                ) : (
                  <p className="text-xs text-[#8A91A3] mt-1.5">Unlinked</p>
                )}
              </div>
            </div>

            {/* 1. Task Overview */}
            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">1. Task Overview</h4>
              <p className="text-sm text-[#263247] whitespace-pre-line leading-relaxed">
                {detailTask.overview || 'No task overview provided.'}
              </p>
            </section>

            {/* 2. Task Checklist */}
            <section className="space-y-2 border-t border-[#E7E9F1] pt-4">
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">2. Task Checklist</h4>
              {detailTask.checklist.length === 0 ? (
                <p className="text-xs text-[#8A91A3]">No checklist items defined.</p>
              ) : (
                <div className="space-y-1.5">
                  {detailTask.checklist.map((chk) => (
                    <label key={chk.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#F4F5FC] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chk.done}
                        onChange={() => toggleDetailChecklist(detailTask, chk.id)}
                        className="rounded border-[#C9CEDE] text-[#7853E8] focus:ring-[#7853E8]"
                      />
                      <span className={`text-sm ${chk.done ? 'line-through text-[#8A91A3]' : 'text-[#263247]'}`}>
                        {chk.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Time Planning */}
            <section className="space-y-1.5 border-t border-[#E7E9F1] pt-4">
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">3. Time Planning</h4>
              <div className="flex items-center gap-6 text-sm">
                <span>
                  Estimated: <strong className="tabular-nums">{formatMinutesToHours(detailTask.estimatedMinutes)}</strong>
                </span>
                <span>
                  Actual: <strong className="tabular-nums">{formatMinutesToHours(detailTask.actualMinutes)}</strong>
                </span>
              </div>
            </section>

            {/* 4. Resources & References */}
            <section className="space-y-1.5 border-t border-[#E7E9F1] pt-4">
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">4. Resources &amp; References</h4>
              <p className="text-sm text-[#263247] whitespace-pre-line">{detailTask.resources || 'None linked.'}</p>
            </section>

            {/* 5. Completion Notes */}
            <section className="space-y-1.5 border-t border-[#E7E9F1] pt-4">
              <h4 className="text-xs font-semibold text-[#8A91A3] uppercase tracking-wider">5. Completion Notes</h4>
              <p className="text-sm text-[#263247] whitespace-pre-line">
                {detailTask.completionNotes || 'No completion notes recorded yet.'}
              </p>
            </section>
          </div>
        )}
      </Modal>

      {/* Create / Edit Task Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={dataset.tasks.some((t) => t.id === draft.id) ? 'Edit Task' : 'Create Task'}
        subtitle="Mapped to Notion Task Manager template sections"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <p className="text-xs font-medium text-[#DC2626] bg-[#DC2626]/10 p-2.5 rounded-lg">{formError}</p>}

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Enter task title"
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg focus:border-[#7853E8] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Priority</label>
              <select
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Related Project</label>
              <select
                value={draft.projectId ?? ''}
                onChange={(e) => {
                  const pid = e.target.value;
                  const proj = projectMap.get(pid);
                  setDraft({ ...draft, projectId: pid, clientId: proj?.clientId ?? draft.clientId });
                }}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                <option value="">None</option>
                {dataset.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Related Client</label>
              <select
                value={draft.clientId ?? ''}
                onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                <option value="">None</option>
                {dataset.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company || c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">1. Task Overview</label>
            <textarea
              rows={2}
              value={draft.overview}
              onChange={(e) => setDraft({ ...draft, overview: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg focus:border-[#7853E8] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">2. Task Checklist</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                placeholder="Add checklist item..."
                className="flex-1 px-3 py-1.5 text-sm border border-[#E7E9F1] rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 text-xs font-medium bg-[#F4F5FC] hover:bg-[#E7E9F1] text-[#263247] rounded-lg cursor-pointer"
              >
                Add
              </button>
            </div>
            {draft.checklist.length > 0 && (
              <div className="space-y-1">
                {draft.checklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-[#F8F9FD] rounded-lg">
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, checklist: d.checklist.filter((x) => x.id !== item.id) }))}
                      className="text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">3. Estimated Time (minutes)</label>
              <input
                type="number"
                min={0}
                value={draft.estimatedMinutes}
                onChange={(e) => setDraft({ ...draft, estimatedMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Actual Time (minutes)</label>
              <input
                type="number"
                min={0}
                value={draft.actualMinutes}
                onChange={(e) => setDraft({ ...draft, actualMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">4. Resources &amp; References</label>
            <input
              type="text"
              value={draft.resources}
              onChange={(e) => setDraft({ ...draft, resources: e.target.value })}
              placeholder="Links, specs, or Notion page references"
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">5. Completion Notes</label>
            <textarea
              rows={2}
              value={draft.completionNotes}
              onChange={(e) => setDraft({ ...draft, completionNotes: e.target.value })}
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
              Save Task
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteTask(deleteTarget.id)}
        title="Delete Task"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
      />
    </div>
  );
}
