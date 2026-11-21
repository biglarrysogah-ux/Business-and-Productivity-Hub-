import {
  ClientItem,
  ExpenseItem,
  IncomeItem,
  InvoiceItem,
  ProjectItem,
  ProposalItem,
  TaskItem,
  TimeEntryItem,
  WorkspaceSettings,
} from '../types/business';

export interface WorkspaceDataset {
  clients: ClientItem[];
  projects: ProjectItem[];
  tasks: TaskItem[];
  invoices: InvoiceItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  timeEntries: TimeEntryItem[];
  proposals: ProposalItem[];
}

export const EMPTY_DATASET: WorkspaceDataset = {
  clients: [],
  projects: [],
  tasks: [],
  invoices: [],
  incomes: [],
  expenses: [],
  timeEntries: [],
  proposals: [],
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  business: {
    businessName: '',
    businessEmail: '',
    businessAddress: '',
    taxId: '',
    defaultCurrency: 'USD',
  },
  preferences: {
    dateFormat: 'MMM D, YYYY',
    compactTables: false,
  },
  targetsByCurrency: {},
};
