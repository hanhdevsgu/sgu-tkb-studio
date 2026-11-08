import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const Toast: React.FC = () => {
  const { toastMessage, setToastMessage } = useTimetableStore();

  if (!toastMessage) return null;

  const isError =
    toastMessage.includes('❌') ||
    toastMessage.includes('Lịch trùng') ||
    toastMessage.includes('Lỗi') ||
    toastMessage.includes('Không thể') ||
    toastMessage.includes('thất bại');

  const isWarning =
    !isError &&
    (toastMessage.includes('⚠️') ||
      toastMessage.includes('🛑') ||
      toastMessage.includes('hết hạn') ||
      toastMessage.includes('Vui lòng'));

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in-0 slide-in-from-bottom-5 duration-200">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-xs sm:text-sm font-semibold ${
          isError
            ? 'bg-rose-600 text-white border-rose-700'
            : isWarning
            ? 'bg-amber-500/95 text-slate-950 border-amber-600'
            : 'bg-card text-foreground border-border'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-white" />
        ) : isWarning ? (
          <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
        )}
        <span>{toastMessage}</span>
        <button
          onClick={() => setToastMessage(null)}
          className="ml-2 opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

