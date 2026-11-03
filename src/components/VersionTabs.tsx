import React from 'react';
import { Plus, X, Calendar, Layers } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const VersionTabs: React.FC = () => {
  const { plans, activeTabId, addPlan, removePlan, switchPlan } = useTimetableStore();

  return (
    <div className="bg-card/40 border-b border-border/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1 hidden sm:flex">
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            <span className="font-semibold text-foreground/80">Kế hoạch:</span>
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
                  transition-all duration-200 group relative text-xs sm:text-sm font-medium
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 font-semibold ring-1 ring-cyan-400/30'
                      : 'bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/70 hover:border-cyan-500/30 hover:-translate-y-0.5'
                  }
                `}
              >
                <Calendar className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-cyan-500'}`} />
                <span>Phương án {index + 1}</span>
                {count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
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
                    className={`opacity-0 group-hover:opacity-100 transition-all ml-0.5 rounded-full p-0.5 cursor-pointer ${
                      isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-500/20 hover:text-rose-400'
                    }`}
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
              className="inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all duration-200 px-3 py-1.5 rounded-xl border border-dashed border-border/90 hover:border-cyan-500/50 text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-cyan-500/5 hover:-translate-y-0.5 active:scale-95"
              title={`Thêm phương án thời khóa biểu (${plans.length}/5)`}
              type="button"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-500" />
              <span>Thêm phương án</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
