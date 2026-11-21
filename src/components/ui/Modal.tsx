import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg' | 'xl';
  variant?: 'center' | 'drawer';
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'lg',
  variant = 'center',
  headerActions,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === 'md' ? 'max-w-lg' : size === 'xl' ? 'max-w-4xl' : 'max-w-2xl';

  if (variant === 'drawer') {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-[#1D2948]/40 backdrop-blur-[1px]" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${sizeClass} bg-white h-full shadow-2xl border-l border-[#E7E9F1] flex flex-col overflow-hidden`}
        >
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E7E9F1] shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#263247] truncate">{title}</h2>
              {subtitle && <p className="text-sm text-[#8A91A3] mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="p-2 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D2948]/45 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${sizeClass} bg-white rounded-2xl shadow-2xl border border-[#E7E9F1] flex flex-col max-h-[90vh] overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E7E9F1] shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#263247] truncate">{title}</h2>
            {subtitle && <p className="text-sm text-[#8A91A3] mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-2 rounded-lg text-[#8A91A3] hover:text-[#263247] hover:bg-[#F4F5FC] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
