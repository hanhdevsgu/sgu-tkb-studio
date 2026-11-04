import React from 'react';
import { Plus, X, Calendar, Layers } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const VersionTabs: React.FC = () => {
  const { plans, activeTabId, addPlan, removePlan, switchPlan } = useTimetableStore();

  return (
    <div className="bg-card/50 border-b border-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1 hidden sm:flex">
            <Layers className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground/80">Phương án:</span>
          </div>

          {plans.map((plan, index) => {
            const isActive = plan.id === activeTabId;
            const count = plan.selectedIds.length;

            return (
              <div
                key={plan.id}
                onClick={() => switchPlan(plan.id)}
                className={`
                  flex items-center gap-2 px-3.5 py-1.5 rounded-xl cursor-pointer whitespace-nowrap
                  transition-all duration-150 group relative text-xs sm:text-sm font-medium
                  ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border shadow-xs'
                  }
                `}
              >
                <Calendar className={`size-3.5 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                <span>Phương án {index + 1}</span>
                {count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
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
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 rounded-full p-0.5 cursor-pointer ${
                      isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-500/20 hover:text-rose-400'
                    }`}
                    title="Xóa phương án này"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {plans.length < 5 && (
            <button
              onClick={addPlan}
              className="inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-colors px-3 py-1.5 rounded-xl border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-primary/5 active:scale-[0.98]"
              title={`Thêm phương án thời khóa biểu (${plans.length}/5)`}
              type="button"
            >
              <Plus className="size-3.5 text-primary" />
              <span>Thêm phương án</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
