import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  ClientItem,
  CurrencyCode,
  ExpenseItem,
  FinancialTargets,
  IncomeItem,
  InvoiceItem,
  NavRoute,
  ProjectItem,
  ProposalItem,
  ReportingPeriod,
  TaskItem,
  TimeEntryItem,
  ToastMessage,
  WorkspaceSettings,
} from '../types/business';
import { DEFAULT_WORKSPACE_SETTINGS, EMPTY_DATASET, WorkspaceDataset } from '../lib/workspaceDefaults';

export type QuickCreateTarget =
  | 'task'
  | 'project'
  | 'client'
  | 'invoice'
  | 'income'
  | 'expense'
  | 'time'
  | 'proposal'
  | null;

interface HubContextValue {
  route: NavRoute;
  setRoute: (route: NavRoute) => void;
  focusedRecordId: string | null;
  setFocusedRecordId: (id: string | null) => void;
  navigateToRecord: (route: NavRoute, recordId: string) => void;

  reportingPeriod: ReportingPeriod;
  setReportingPeriod: (period: ReportingPeriod) => void;
  currencyFilter: CurrencyCode | 'ALL';
  setCurrencyFilter: (currency: CurrencyCode | 'ALL') => void;

  dataset: WorkspaceDataset;
  settings: WorkspaceSettings;
  updateSettings: (updater: (prev: WorkspaceSettings) => WorkspaceSettings) => void;
  updateFinancialTargets: (currency: CurrencyCode, targets: FinancialTargets) => void;

  quickCreate: QuickCreateTarget;
  openQuickCreate: (target: QuickCreateTarget) => void;

  upsertTask: (item: TaskItem) => void;
  deleteTask: (id: string) => void;
  toggleTaskComplete: (id: string) => void;

  upsertProject: (item: ProjectItem) => void;
  deleteProject: (id: string) => void;

  upsertClient: (item: ClientItem) => void;
  deleteClient: (id: string) => void;

  upsertInvoice: (item: InvoiceItem) => void;
  deleteInvoice: (id: string) => void;
  recordInvoicePayment: (invoiceId: string, amount: number, paymentMethod: string, paymentDate: string) => void;

  upsertIncome: (item: IncomeItem) => void;
  deleteIncome: (id: string) => void;

  upsertExpense: (item: ExpenseItem) => void;
  deleteExpense: (id: string) => void;

  upsertTimeEntry: (item: TimeEntryItem) => void;
  deleteTimeEntry: (id: string) => void;

  upsertProposal: (item: ProposalItem) => void;
  deleteProposal: (id: string) => void;

  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<NavRoute>('dashboard');
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod>('year_to_date');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | 'ALL'>('USD');
  const [dataset, setDataset] = useState<WorkspaceDataset>(() => structuredClone(EMPTY_DATASET));
  const [settings, setSettings] = useState<WorkspaceSettings>(() => structuredClone(DEFAULT_WORKSPACE_SETTINGS));
  const [quickCreate, setQuickCreate] = useState<QuickCreateTarget>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigateToRecord = useCallback((targetRoute: NavRoute, recordId: string) => {
    setRoute(targetRoute);
    setFocusedRecordId(recordId);
  }, []);

  const openQuickCreate = useCallback((target: QuickCreateTarget) => {
    if (target) {
      const routeMap: Record<Exclude<QuickCreateTarget, null>, NavRoute> = {
        task: 'tasks',
        project: 'projects',
        client: 'clients',
        invoice: 'invoices',
        income: 'income',
        expense: 'expenses',
        time: 'time-tracking',
        proposal: 'proposals',
      };
      setRoute(routeMap[target]);
    }
    setQuickCreate(target);
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: WorkspaceSettings) => WorkspaceSettings) => {
      setSettings((prev) => updater(prev));
      addToast({ type: 'success', title: 'Settings saved', description: 'Workspace preferences updated.' });
    },
    [addToast]
  );

  const updateFinancialTargets = useCallback(
    (currency: CurrencyCode, targets: FinancialTargets) => {
      setSettings((prev) => ({
        ...prev,
        targetsByCurrency: {
          ...prev.targetsByCurrency,
          [currency]: targets,
        },
      }));
      addToast({
        type: 'success',
        title: `${currency} targets updated`,
        description: 'Financial Performance progress bars recalculated.',
      });
    },
    [addToast]
  );

  const upsertCollectionItem = <T extends { id: string }>(
    key: keyof WorkspaceDataset,
    item: T,
    label: string
  ) => {
    setDataset((prev) => {
      const list = prev[key] as unknown as T[];
      const exists = list.some((x) => x.id === item.id);
      const nextList = exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
      return { ...prev, [key]: nextList };
    });
    addToast({
      type: 'success',
      title: `${label} saved`,
      description: 'Connect Notion in Settings to synchronize records with your workspace.',
    });
  };

  const deleteCollectionItem = (key: keyof WorkspaceDataset, id: string, label: string) => {
    setDataset((prev) => {
      const list = prev[key] as unknown as { id: string }[];
      return { ...prev, [key]: list.filter((x) => x.id !== id) };
    });
    if (focusedRecordId === id) setFocusedRecordId(null);
    addToast({ type: 'info', title: `${label} deleted` });
  };

  const upsertTask = useCallback((item: TaskItem) => upsertCollectionItem('tasks', item, 'Task'), [addToast]);
  const deleteTask = useCallback((id: string) => deleteCollectionItem('tasks', id, 'Task'), [addToast, focusedRecordId]);

  const toggleTaskComplete = useCallback(
    (id: string) => {
      setDataset((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: t.status === 'Completed' ? 'In Progress' : 'Completed',
                updatedAt: new Date().toISOString(),
              }
            : t
        ),
      }));
      addToast({ type: 'success', title: 'Task status updated' });
    },
    [addToast]
  );

  const upsertProject = useCallback((item: ProjectItem) => upsertCollectionItem('projects', item, 'Project'), [addToast]);
  const deleteProject = useCallback((id: string) => deleteCollectionItem('projects', id, 'Project'), [addToast, focusedRecordId]);

  const upsertClient = useCallback((item: ClientItem) => upsertCollectionItem('clients', item, 'Client'), [addToast]);
  const deleteClient = useCallback((id: string) => deleteCollectionItem('clients', id, 'Client'), [addToast, focusedRecordId]);

  const upsertInvoice = useCallback((item: InvoiceItem) => upsertCollectionItem('invoices', item, 'Invoice'), [addToast]);
  const deleteInvoice = useCallback((id: string) => deleteCollectionItem('invoices', id, 'Invoice'), [addToast, focusedRecordId]);

  const recordInvoicePayment = useCallback(
    (invoiceId: string, amount: number, paymentMethod: string, paymentDate: string) => {
      const invoice = dataset.invoices.find((i) => i.id === invoiceId);
      if (!invoice || amount <= 0) return;
      const now = new Date().toISOString();
      const newIncome: IncomeItem = {
        id: `inc-${Date.now()}`,
        title: `Payment for ${invoice.invoiceNumber}`,
        date: paymentDate,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        invoiceId: invoice.id,
        category: 'Client Project',
        description: `Verified payment applied to ${invoice.invoiceNumber}`,
        amount,
        currency: invoice.currency,
        paymentMethod,
        isRecurring: false,
        verified: true,
        overview: `Payment recorded against invoice ${invoice.invoiceNumber}.`,
        breakdown: `Amount: ${amount} ${invoice.currency}`,
        financialNotes: `Payment method: ${paymentMethod}`,
        finalNotes: '',
        createdAt: now,
        updatedAt: now,
      };
      setDataset((prev) => ({
        ...prev,
        incomes: [newIncome, ...prev.incomes],
        invoices: prev.invoices.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                paymentConfirmed: true,
                paidAmountRecorded: inv.paidAmountRecorded + amount,
                paymentMethod,
                paymentRecordNotes: `${inv.paymentRecordNotes ? inv.paymentRecordNotes + '\n' : ''}Verified ${amount} ${inv.currency} via ${paymentMethod} on ${paymentDate}.`,
                updatedAt: now,
              }
            : inv
        ),
      }));
      addToast({
        type: 'success',
        title: 'Payment recorded & linked',
        description: `Created verified Income entry and updated ${invoice.invoiceNumber}.`,
      });
    },
    [dataset.invoices, addToast]
  );

  const upsertIncome = useCallback((item: IncomeItem) => upsertCollectionItem('incomes', item, 'Income record'), [addToast]);
  const deleteIncome = useCallback((id: string) => deleteCollectionItem('incomes', id, 'Income record'), [addToast, focusedRecordId]);

  const upsertExpense = useCallback((item: ExpenseItem) => upsertCollectionItem('expenses', item, 'Expense record'), [addToast]);
  const deleteExpense = useCallback((id: string) => deleteCollectionItem('expenses', id, 'Expense record'), [addToast, focusedRecordId]);

  const upsertTimeEntry = useCallback((item: TimeEntryItem) => upsertCollectionItem('timeEntries', item, 'Time entry'), [addToast]);
  const deleteTimeEntry = useCallback((id: string) => deleteCollectionItem('timeEntries', id, 'Time entry'), [addToast, focusedRecordId]);

  const upsertProposal = useCallback((item: ProposalItem) => upsertCollectionItem('proposals', item, 'Proposal'), [addToast]);
  const deleteProposal = useCallback((id: string) => deleteCollectionItem('proposals', id, 'Proposal'), [addToast, focusedRecordId]);

  const value = useMemo<HubContextValue>(
    () => ({
      route,
      setRoute,
      focusedRecordId,
      setFocusedRecordId,
      navigateToRecord,
      reportingPeriod,
      setReportingPeriod,
      currencyFilter,
      setCurrencyFilter,
      dataset,
      settings,
      updateSettings,
      updateFinancialTargets,
      quickCreate,
      openQuickCreate,
      upsertTask,
      deleteTask,
      toggleTaskComplete,
      upsertProject,
      deleteProject,
      upsertClient,
      deleteClient,
      upsertInvoice,
      deleteInvoice,
      recordInvoicePayment,
      upsertIncome,
      deleteIncome,
      upsertExpense,
      deleteExpense,
      upsertTimeEntry,
      deleteTimeEntry,
      upsertProposal,
      deleteProposal,
      toasts,
      addToast,
      dismissToast,
    }),
    [
      route,
      focusedRecordId,
      navigateToRecord,
      reportingPeriod,
      currencyFilter,
      dataset,
      settings,
      updateSettings,
      updateFinancialTargets,
      quickCreate,
      openQuickCreate,
      upsertTask,
      deleteTask,
      toggleTaskComplete,
      upsertProject,
      deleteProject,
      upsertClient,
      deleteClient,
      upsertInvoice,
      deleteInvoice,
      recordInvoicePayment,
      upsertIncome,
      deleteIncome,
      upsertExpense,
      deleteExpense,
      upsertTimeEntry,
      deleteTimeEntry,
      upsertProposal,
      deleteProposal,
      toasts,
      addToast,
      dismissToast,
    ]
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub(): HubContextValue {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used within HubProvider');
  return ctx;
}
