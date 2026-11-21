import { useMemo, useState } from 'react';
import { BookOpen, Search, ArrowRight } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { NavRoute } from '../types/business';

interface GuideTopic {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  route?: NavRoute;
}

const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'duplicate-template',
    title: '1. Duplicating the Notion Template (Separate from OAuth)',
    category: 'Onboarding',
    summary:
      'Before connecting your workspace, duplicate the official Business and Productivity Hub Notion template into your own Notion workspace.',
    steps: [
      'After purchasing on Whop, open your private template link.',
      'Click "Duplicate" in the top-right corner of Notion and select your own workspace.',
      'Wait for Notion to finish copying all 8 databases (Task Manager, Project Manager, Client Manager, Invoice Manager, Income Tracker, Expense Tracker, Time Tracker, Proposal Tracker).',
      'Important: OAuth authorization does NOT duplicate templates automatically — you must duplicate first, then authorize access.',
    ],
  },
  {
    id: 'connect-notion',
    title: '2. Connecting Notion & Authorizing Pages',
    category: 'Onboarding',
    summary:
      'Connect your individual Notion workspace via OAuth so the website reads and writes exclusively to your own databases.',
    steps: [
      'Go to Settings → Notion Connection.',
      'Click "Connect Notion Workspace" once server-side Notion OAuth credentials are configured.',
      'In the Notion consent screen, choose "Select pages" and check the duplicated Business and Productivity Hub parent page so all 8 child databases are included.',
      'Your Notion access token is stored encrypted server-side and is never shared with other customers.',
    ],
    route: 'settings',
  },
  {
    id: 'map-databases',
    title: '3. Mapping Your 8 Notion Databases',
    category: 'Onboarding',
    summary:
      'Confirm which Notion database powers each website module, even if you renamed a database in Notion.',
    steps: [
      'After OAuth authorization, the platform discovers accessible databases and their data sources.',
      'Review the auto-matched mapping table in Settings → Notion Connection.',
      'If any database was renamed, select it manually from the dropdown for that module.',
      'If a database is missing, re-authorize Notion and ensure the duplicated hub page was selected.',
    ],
    route: 'settings',
  },
  {
    id: 'tasks',
    title: '4. Creating & Organizing Tasks',
    category: 'Modules',
    summary: 'Manage daily work using Table, Board, and Schedule views while preserving all 5 Notion task template sections.',
    steps: [
      'Navigate to Tasks or click "Add Task" in Dashboard Quick Actions.',
      'Set status, priority, due date, and optional Project/Client links.',
      'Use interactive checklists inside the Task Detail drawer.',
    ],
    route: 'tasks',
  },
  {
    id: 'projects',
    title: '5. Managing Projects & Financial Rollups',
    category: 'Modules',
    summary: 'Track deliverables, milestones, and project-level profitability calculated as Total Income minus Total Expenses.',
    steps: [
      'Open Projects and switch between Table, Board, and Timeline views.',
      'Link Income and Expense records to a Project so they appear in that project’s financial rollup.',
      'General business overhead (unlinked transactions) appears in your workspace-wide P&L, not inside individual project totals.',
    ],
    route: 'projects',
  },
  {
    id: 'clients',
    title: '6. Managing Clients',
    category: 'Modules',
    summary: 'Keep a unified client directory with linked projects, invoices, proposals, and relationship notes.',
    steps: [
      'Open Clients and click "Add Client".',
      'Click any client row to inspect all 8 Notion Client template sections and linked records.',
    ],
    route: 'clients',
  },
  {
    id: 'invoices',
    title: '7. Creating Invoices & Verifying Payments',
    category: 'Finance',
    summary: 'Generate itemized invoices, print client-ready statements, and verify payments via linked Income records.',
    steps: [
      'Create an invoice with line items, tax rate, and currency.',
      'An invoice is only marked "Paid" when verified payment records or linked Income transactions cover the invoice total.',
      'Use "Record Pay" on any unpaid invoice to log a verified Income entry and update the balance automatically.',
    ],
    route: 'invoices',
  },
  {
    id: 'income',
    title: '8. Recording Income',
    category: 'Finance',
    summary: 'Log client payments, retainers, and consulting revenue with recurring tracking and verification status.',
    steps: [
      'Open Income and click "Record Income".',
      'Link a Client, Project, or Invoice where applicable.',
    ],
    route: 'income',
  },
  {
    id: 'expenses',
    title: '9. Recording Expenses & Tax Deductibility',
    category: 'Finance',
    summary: 'Log vendor bills, SaaS subscriptions, contractor payouts, and receipt references.',
    steps: [
      'Open Expenses and click "Add Expense".',
      'Mark whether the expense is tax-deductible and link a Project if it is a direct project cost.',
    ],
    route: 'expenses',
  },
  {
    id: 'time-tracking',
    title: '10. Tracking Working Hours',
    category: 'Productivity',
    summary: 'Use the live session timer or manual time entry to track billable hours and estimated earnings.',
    steps: [
      'Start the live timer in Time Tracking and click "Stop & Save" when finished.',
      'Assign hourly rate, currency, and billable flag.',
    ],
    route: 'time-tracking',
  },
  {
    id: 'proposals',
    title: '11. Managing Business Proposals',
    category: 'Growth',
    summary: 'Track submitted proposals, follow-up dates, pricing terms, and approval status.',
    steps: [
      'Create proposals in Proposals and set a follow-up reminder date.',
      'Follow-up Due items automatically appear in the Top Bar notification reminders.',
    ],
    route: 'proposals',
  },
  {
    id: 'financial-reports',
    title: '12. Understanding Financial Reports & Targets',
    category: 'Finance',
    summary: 'Interpret Business Overview KPIs, Revenue Trend charts, and user-defined Financial Performance targets.',
    steps: [
      'Use the Reporting Period selector in the top bar to filter by This Month, Last 30 Days, Quarter, YTD, or All Time.',
      'Click "Edit Targets" on the Financial Performance card to define your own income, expense, and profit goals.',
    ],
    route: 'dashboard',
  },
  {
    id: 'multi-currency',
    title: '13. Handling Multiple Currencies Safely',
    category: 'Finance',
    summary: 'All 11 supported currencies (USD, GBP, EUR, CAD, AUD, GHS, NGN, ZAR, INR, JPY, CHF) are strictly isolated.',
    steps: [
      'The platform never blindly adds GHS 1,000 + USD 500 together.',
      'Totals are grouped per original currency across every table and summary.',
      'Use the Currency Selector in the top navigation to focus charts and KPIs on a single currency.',
    ],
    route: 'analytics',
  },
  {
    id: 'troubleshooting',
    title: '14. Troubleshooting Connection Issues',
    category: 'Support',
    summary: 'Common steps when a Notion database is missing or a write fails.',
    steps: [
      'Ensure you duplicated the template BEFORE authorizing OAuth.',
      'Verify you granted access to the parent template page containing all 8 databases.',
      'Check Settings → Notion Connection to remap renamed databases.',
      'Live Notion OAuth and database discovery require server-side Notion OAuth credentials to be configured.',
    ],
    route: 'settings',
  },
];

export function HelpGuidePage() {
  const { setRoute } = useHub();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDE_TOPICS;
    return GUIDE_TOPICS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.steps.some((s) => s.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#263247]">Customer User Guide</h2>
        <p className="text-sm text-[#8A91A3] mt-0.5">
          Step-by-step documentation for onboarding, Notion workspace connection, multi-currency accounting, and daily workflows.
        </p>
      </div>

      <div className="bg-white border border-[#E7E9F1] rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#8A91A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help topics (e.g. currencies, invoices, OAuth)..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#F4F5FC] border border-transparent focus:border-[#7853E8] focus:bg-white rounded-lg outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((topic) => (
          <div
            key={topic.id}
            className="bg-white border border-[#E7E9F1] rounded-xl p-5 shadow-[0_1px_3px_rgba(29,41,72,0.04)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-[#7853E8]">{topic.category}</span>
                <BookOpen className="w-4 h-4 text-[#8A91A3]" />
              </div>
              <h3 className="font-display text-base font-semibold text-[#263247]">{topic.title}</h3>
              <p className="text-xs text-[#4E596F] mt-1.5 leading-relaxed">{topic.summary}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-[#263247] list-disc pl-4">
                {topic.steps.map((s, idx) => (
                  <li key={idx} className="leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>
            {topic.route && (
              <div className="mt-4 pt-3 border-t border-[#E7E9F1]">
                <button
                  type="button"
                  onClick={() => setRoute(topic.route!)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7853E8] hover:underline cursor-pointer"
                >
                  <span>Go to module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
