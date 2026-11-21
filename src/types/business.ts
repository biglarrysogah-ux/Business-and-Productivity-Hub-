export type CurrencyCode =
  | 'USD'
  | 'GBP'
  | 'EUR'
  | 'CAD'
  | 'AUD'
  | 'GHS'
  | 'NGN'
  | 'ZAR'
  | 'INR'
  | 'JPY'
  | 'CHF';

export type NavRoute =
  | 'dashboard'
  | 'analytics'
  | 'tasks'
  | 'projects'
  | 'clients'
  | 'invoices'
  | 'income'
  | 'expenses'
  | 'time-tracking'
  | 'proposals'
  | 'help'
  | 'settings';

export type ReportingPeriod =
  | 'this_month'
  | 'last_30_days'
  | 'this_quarter'
  | 'year_to_date'
  | 'all_time';

export type TaskStatus = 'Not Started' | 'In Progress' | 'Waiting' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  projectId?: string;
  clientId?: string;
  // Notion Task Template Sections:
  overview: string;
  checklist: ChecklistItem[];
  estimatedMinutes: number;
  actualMinutes: number;
  resources: string;
  completionNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'Not Started' | 'In Progress' | 'On Hold' | 'Completed';

export interface ProjectItem {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  clientId?: string;
  budget: number;
  currency: CurrencyCode;
  // Notion Project Template Sections:
  overview: string;
  scopeDeliverables: string;
  milestonesTimeline: string;
  tasksActionPlan: string;
  clientRequirements: string;
  resourcesFiles: string;
  budgetPlanning: string;
  challengesUpdates: string;
  completionHandover: string;
  createdAt: string;
  updatedAt: string;
}

export type ClientStatus = 'Lead' | 'Active' | 'Retainer' | 'Completed' | 'Inactive';

export interface ClientItem {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  status: ClientStatus;
  preferredCurrency: CurrencyCode;
  // Notion Client Template Sections:
  overview: string;
  requirements: string;
  servicesProvided: string;
  communicationMeetings: string;
  agreementsExpectations: string;
  documentsResources: string;
  relationshipNotes: string;
  reviewSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type InvoicePaymentStatus = 'Draft' | 'Sent' | 'Partially Paid' | 'Paid' | 'Overdue';

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  lineItems: InvoiceLineItem[];
  taxRate: number; // percentage e.g. 0, 10
  // Payment verification: derived/confirmed from actual payment info or linked Income records
  paymentConfirmed: boolean;
  paidAmountRecorded: number;
  paymentMethod?: string;
  // Notion Invoice Template Sections:
  overview: string;
  freelancerInfo: string;
  clientInfo: string;
  projectInfo: string;
  paymentInstructions: string;
  paymentTerms: string;
  paymentRecordNotes: string;
  finalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type IncomeCategory =
  | 'Client Project'
  | 'Retainer'
  | 'Consulting'
  | 'Product Sales'
  | 'Maintenance'
  | 'Other';

export interface IncomeItem {
  id: string;
  title: string;
  date: string;
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  category: IncomeCategory;
  description: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: string;
  isRecurring: boolean;
  recurringFrequency?: 'Monthly' | 'Quarterly' | 'Annually';
  verified: boolean;
  // Notion Income Template Sections:
  overview: string;
  breakdown: string;
  financialNotes: string;
  finalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'Software & SaaS'
  | 'Contractors'
  | 'Marketing'
  | 'Equipment'
  | 'Travel'
  | 'Office & Utilities'
  | 'Professional Fees'
  | 'Other';

export interface ExpenseItem {
  id: string;
  title: string;
  date: string;
  vendor: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: string;
  clientId?: string;
  projectId?: string;
  receiptRef: string;
  isRecurring: boolean;
  recurringFrequency?: 'Monthly' | 'Quarterly' | 'Annually';
  taxDeductible: boolean;
  // Notion Expense Template Sections:
  overview: string;
  breakdown: string;
  taxNotes: string;
  finalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryItem {
  id: string;
  title: string;
  workDate: string;
  clientId?: string;
  projectId?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  billable: boolean;
  hourlyRate: number;
  currency: CurrencyCode;
  // Notion Time Template Sections:
  workOverview: string;
  workCompleted: string;
  resources: string;
  workNotes: string;
  verified: boolean;
  followUpActions: string;
  finalSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type ProposalStatus = 'Draft' | 'Sent' | 'Under Review' | 'Follow-up Due' | 'Accepted' | 'Declined';

export interface ProposalItem {
  id: string;
  title: string;
  clientId: string;
  projectId?: string;
  status: ProposalStatus;
  submissionDate: string;
  followUpDate: string;
  proposedAmount: number;
  currency: CurrencyCode;
  // Notion Proposal Template Sections:
  overview: string;
  scopeDeliverables: string;
  timelineMilestones: string;
  pricingTerms: string;
  requirements: string;
  termsConditions: string;
  expectedResults: string;
  nextSteps: string;
  followUpNotes: string;
  finalApproval: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTargets {
  currency: CurrencyCode;
  incomeTarget: number;
  expenseBudget: number;
  profitTarget: number;
}

export interface WorkspaceSettings {
  business: {
    businessName: string;
    businessEmail: string;
    businessAddress: string;
    taxId: string;
    defaultCurrency: CurrencyCode;
  };
  preferences: {
    dateFormat: 'YYYY-MM-DD' | 'MMM D, YYYY' | 'DD/MM/YYYY';
    compactTables: boolean;
  };
  targetsByCurrency: Record<string, FinancialTargets>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
