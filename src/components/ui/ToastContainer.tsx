import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useHub } from '../../context/HubContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useHub();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;
        const iconColor =
          toast.type === 'success'
            ? 'text-[#2DAA82]'
            : toast.type === 'error'
              ? 'text-[#DC2626]'
              : 'text-[#7853E8]';

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto bg-white border border-[#E7E9F1] rounded-xl shadow-lg p-4 flex items-start gap-3 transition-all duration-150"
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#263247]">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-[#8A91A3] mt-0.5 leading-relaxed">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-[#8A91A3] hover:text-[#263247] p-1 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
