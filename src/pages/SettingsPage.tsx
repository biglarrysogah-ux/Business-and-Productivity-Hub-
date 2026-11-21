import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Database,
  Info,
  KeyRound,
  Save,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
import { CurrencyCode } from '../types/business';
import { StatusBadge } from '../components/ui/StatusBadge';

const EXPECTED_NOTION_DATABASES = [
  { module: 'Task Manager', notionName: 'Task Manager', status: 'Awaiting Notion OAuth' },
  { module: 'Project Manager', notionName: 'Project Manager', status: 'Awaiting Notion OAuth' },
  { module: 'Client Manager', notionName: 'Client Manager', status: 'Awaiting Notion OAuth' },
  { module: 'Invoice Manager', notionName: 'Invoice Manager', status: 'Awaiting Notion OAuth' },
  { module: 'Income Tracker', notionName: 'Income Tracker', status: 'Awaiting Notion OAuth' },
  { module: 'Expense Tracker', notionName: 'Expense Tracker', status: 'Awaiting Notion OAuth' },
  { module: 'Time Tracker', notionName: 'Time Tracker', status: 'Awaiting Notion OAuth' },
  { module: 'Proposal Tracker', notionName: 'Proposal Tracker', status: 'Awaiting Notion OAuth' },
];

export function SettingsPage() {
  const { settings, updateSettings, addToast } = useHub();

  const [business, setBusiness] = useState(settings.business);
  const [preferences, setPreferences] = useState(settings.preferences);

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings((prev) => ({ ...prev, business }));
  };

  const handleSavePrefs = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings((prev) => ({ ...prev, preferences }));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#263247]">Settings</h2>
        <p className="text-sm text-[#8A91A3] mt-0.5">
          Manage your Notion workspace connection, business invoice defaults, and display preferences.
        </p>
      </div>

      {/* Notion Connection & Database Mapping */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9F1] pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7853E8]/10 text-[#7853E8] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-[#263247]">Notion Workspace Connection</h3>
              <p className="text-xs text-[#8A91A3] mt-0.5">
                Connect your own duplicated Notion workspace via server-side OAuth so all records sync directly to your databases.
              </p>
            </div>
          </div>
          <StatusBadge label="Not Connected" tone="amber" />
        </div>

        <div className="bg-[#F4F5FC] border border-[#E7E9F1] rounded-xl p-4 flex items-start gap-3 text-xs text-[#4E596F]">
          <Info className="w-4 h-4 text-[#7853E8] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[#263247]">Notion Integration Architecture</p>
            <p>
              Server-side Notion OAuth requires <code className="font-mono">NOTION_CLIENT_ID</code>,{' '}
              <code className="font-mono">NOTION_CLIENT_SECRET</code>, and{' '}
              <code className="font-mono">NOTION_REDIRECT_URI</code> to be configured on the server. Customer access tokens are stored encrypted server-side and never exposed in browser code.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              addToast({
                type: 'info',
                title: 'Notion OAuth not yet configured',
                description:
                  'Supply server-side Notion OAuth credentials and complete the Notion API integration phase to authorize your workspace.',
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Connect Notion Workspace</span>
          </button>
          <span className="text-xs text-[#8A91A3]">
            Step 1: Duplicate Notion template · Step 2: Authorize OAuth · Step 3: Confirm 8 database mappings
          </span>
        </div>

        {/* 8-Module Database Mapping Table */}
        <div className="border border-[#E7E9F1] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FD] border-b border-[#E7E9F1] text-[#8A91A3]">
              <tr>
                <th className="px-4 py-2.5">Website Module</th>
                <th className="px-4 py-2.5">Expected Notion Database</th>
                <th className="px-4 py-2.5">Mapping Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9F1]">
              {EXPECTED_NOTION_DATABASES.map((row) => (
                <tr key={row.module}>
                  <td className="px-4 py-2.5 font-semibold text-[#263247]">{row.module}</td>
                  <td className="px-4 py-2.5 font-mono text-[#4E596F]">{row.notionName}</td>
                  <td className="px-4 py-2.5 text-[#8A91A3]">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commercial Access Notice (Whop) */}
      <div className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(29,41,72,0.04)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#E9AD58]" />
            <h3 className="font-display text-base font-semibold text-[#263247]">Product Access (Whop)</h3>
          </div>
          <StatusBadge label="Pending Whop Verification" tone="neutral" />
        </div>
        <p className="text-xs text-[#4E596F] leading-relaxed">
          Customer access and purchase verification will be managed through Whop together with your Notion workspace authorization. There is no separate website registration or sign-up system.
        </p>
      </div>

      {/* Business & Display Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSaveBusiness} className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E7E9F1] pb-3">
            <Building2 className="w-4 h-4 text-[#39B5B6]" />
            <h3 className="font-display text-base font-semibold text-[#263247]">Business &amp; Currency Settings</h3>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Business Name</label>
            <input
              type="text"
              value={business.businessName}
              onChange={(e) => setBusiness({ ...business, businessName: e.target.value })}
              placeholder="Enter your business name"
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Default Currency</label>
              <select
                value={business.defaultCurrency}
                onChange={(e) => setBusiness({ ...business, defaultCurrency: e.target.value as CurrencyCode })}
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#263247] mb-1">Tax ID / Registration</label>
              <input
                type="text"
                value={business.taxId}
                onChange={(e) => setBusiness({ ...business, taxId: e.target.value })}
                placeholder="Optional tax or registration ID"
                className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Business Address (for Invoices)</label>
            <input
              type="text"
              value={business.businessAddress}
              onChange={(e) => setBusiness({ ...business, businessAddress: e.target.value })}
              placeholder="Enter your business billing address"
              className="w-full px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg"
            />
          </div>
          <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
            <Save className="w-3.5 h-3.5" />
            <span>Save Business Settings</span>
          </button>
        </form>

        <form onSubmit={handleSavePrefs} className="bg-white border border-[#E7E9F1] rounded-xl p-5 sm:p-6 space-y-4 self-start">
          <h3 className="font-display text-base font-semibold text-[#263247] border-b border-[#E7E9F1] pb-3">
            Display Preferences
          </h3>
          <div>
            <label className="block text-xs font-semibold text-[#263247] mb-1">Date Format</label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value as typeof preferences.dateFormat })}
              className="w-full sm:w-auto px-3 py-2 text-sm border border-[#E7E9F1] rounded-lg bg-white"
            >
              <option value="MMM D, YYYY">Nov 21, 2026</option>
              <option value="YYYY-MM-DD">2026-11-21</option>
              <option value="DD/MM/YYYY">21/11/2026</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[#263247] cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.compactTables}
              onChange={(e) => setPreferences({ ...preferences, compactTables: e.target.checked })}
            />
            <span>Compact table row density</span>
          </label>
          <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#7853E8] hover:bg-[#6641D4] rounded-lg cursor-pointer">
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </form>
      </div>
    </div>
  );
}
