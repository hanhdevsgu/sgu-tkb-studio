import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const Toast: React.FC = () => {
  const { toastMessage, setToastMessage } = useTimetableStore();

  if (!toastMessage) return null;

  const isError = toastMessage.includes('Lịch trùng') || toastMessage.includes('Lỗi');

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in-0 slide-in-from-bottom-5 duration-200">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-none border shadow-lg text-sm font-medium ${
          isError
            ? 'bg-destructive/95 text-destructive-foreground border-destructive'
            : 'bg-card text-foreground border-border'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-white" />
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

