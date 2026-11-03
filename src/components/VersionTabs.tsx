import React from 'react';
import { Plus, X } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const VersionTabs: React.FC = () => {
  const { plans, activeTabId, addPlan, removePlan, switchPlan } = useTimetableStore();

  return (
    <div className="bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide py-2">
          {plans.map((plan) => {
            const isActive = plan.id === activeTabId;
            const count = plan.selectedIds.length;

            return (
              <div
                key={plan.id}
                onClick={() => switchPlan(plan.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 border-b-2 cursor-pointer whitespace-nowrap
                  transition-colors group relative font-mono text-label
                  ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <span className="font-medium uppercase tracking-wider">{plan.name}</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground text-xs">
                    {count}
                  </span>
                )}
                {plans.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePlan(plan.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-destructive/10 rounded-sm p-0.5 cursor-pointer"
                    title="Xóa phiên bản"
                  >
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}

          {plans.length < 5 && (
            <button
              onClick={addPlan}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 h-8 px-3 gap-2 rounded-none cursor-pointer"
              title={`Thêm phiên bản (${plans.length}/5)`}
              type="button"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Thêm phiên bản</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

