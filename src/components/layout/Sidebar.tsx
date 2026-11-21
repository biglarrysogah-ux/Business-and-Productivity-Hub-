import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  FolderKanban,
  Users,
  FileText,
  TrendingUp,
  Receipt,
  Clock,
  FileSpreadsheet,
  HelpCircle,
  Settings,
  Layers,
  X,
  Database,
} from 'lucide-react';
import { useHub } from '../../context/HubContext';
import { NavRoute } from '../../types/business';

interface NavItem {
  id: NavRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: 'core' | 'modules' | 'support';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'core' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'core' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, section: 'modules' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, section: 'modules' },
  { id: 'clients', label: 'Clients', icon: Users, section: 'modules' },
  { id: 'invoices', label: 'Invoices', icon: FileText, section: 'modules' },
  { id: 'income', label: 'Income', icon: TrendingUp, section: 'modules' },
  { id: 'expenses', label: 'Expenses', icon: Receipt, section: 'modules' },
  { id: 'time-tracking', label: 'Time Tracking', icon: Clock, section: 'modules' },
  { id: 'proposals', label: 'Proposals', icon: FileSpreadsheet, section: 'modules' },
  { id: 'help', label: 'Help / User Guide', icon: HelpCircle, section: 'support' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'support' },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { route, setRoute, setFocusedRecordId } = useHub();

  const handleSelect = (id: NavRoute) => {
    setRoute(id);
    setFocusedRecordId(null);
    onCloseMobile();
  };

  const renderSection = (section: 'core' | 'modules' | 'support', heading?: string) => {
    const items = NAV_ITEMS.filter((item) => item.section === section);
    return (
      <div className="space-y-1">
        {heading && (
          <p className="px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-wider text-[#8A91A3]/80">
            {heading}
          </p>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const active = route === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#7853E8] text-white shadow-sm'
                  : 'text-[#C4CBE0] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const sidebarContent = (
    <div className="h-full w-64 bg-[#1D2948] text-white flex flex-col select-none">
      {/* Brand header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => handleSelect('dashboard')}
          className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#7853E8] flex items-center justify-center shrink-0 shadow-sm">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="block font-display text-sm font-semibold leading-tight text-white truncate">
              Business &amp;
            </span>
            <span className="block font-display text-xs font-medium leading-tight text-[#C4CBE0] truncate">
              Productivity Hub
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-[#C4CBE0] hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation items */}
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4">
        {renderSection('core')}
        {renderSection('modules', 'Business Modules')}
        {renderSection('support', 'Resources')}
      </nav>

      {/* Notion Connection Status */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => handleSelect('settings')}
          className="w-full text-left p-3 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Database className="w-3.5 h-3.5 text-[#39B5B6] shrink-0" />
            <span className="truncate">Notion Not Connected</span>
          </div>
          <p className="text-[11px] text-[#A8B0C8] mt-1 leading-snug">
            Connect your Notion workspace in Settings to sync your 8 databases.
          </p>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30 w-64">{sidebarContent}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-[#1D2948]/50 backdrop-blur-[1px]"
          onClick={onCloseMobile}
        >
          <div onClick={(e) => e.stopPropagation()} className="h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
