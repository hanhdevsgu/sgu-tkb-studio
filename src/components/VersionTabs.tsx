import React from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const VersionTabs: React.FC = () => {
  const { plans, activeTabId, addPlan, removePlan, switchPlan } = useTimetableStore();

  return (
    <div className="bg-card/50 border-b border-border/80 backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-2">
          {plans.map((plan, index) => {
            const isActive = plan.id === activeTabId;
            const count = plan.selectedIds.length;

            return (
              <div
                key={plan.id}
                onClick={() => switchPlan(plan.id)}
                className={`
                  flex items-center gap-2 px-3.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap
                  transition-all duration-200 group relative text-xs sm:text-sm font-medium
                  ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                  }
                `}
              >
                <Calendar className={`w-3.5 h-3.5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span>Phương án {index + 1}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                      isActive
                        ? 'bg-background/20 text-primary-foreground'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {count} lớp
                  </span>
                )}
                {plans.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePlan(plan.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:bg-destructive/20 rounded-full p-0.5 cursor-pointer"
                    title="Xóa phương án này"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {plans.length < 5 && (
            <button
              onClick={addPlan}
              className="inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all px-2.5 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-muted/30"
              title={`Thêm phương án thời khóa biểu (${plans.length}/5)`}
              type="button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm phương án</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
