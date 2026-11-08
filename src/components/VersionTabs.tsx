import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Calendar, Layers, Pencil, Check } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const VersionTabs: React.FC = () => {
  const { plans, activeTabId, addPlan, removePlan, switchPlan, renamePlan } = useTimetableStore();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPlanId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPlanId]);

  const handleStartRename = (planId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlanId(planId);
    setEditingName(currentName);
  };

  const handleSaveRename = (planId: string) => {
    if (editingName.trim()) {
      renamePlan(planId, editingName.trim());
    }
    setEditingPlanId(null);
  };

  const handleKeyDown = (planId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename(planId);
    } else if (e.key === 'Escape') {
      setEditingPlanId(null);
    }
  };

  return (
    <div className="bg-card/50 border-b border-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1 hidden sm:flex">
            <Layers className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground/80">Phương án:</span>
          </div>

          {plans.map((plan) => {
            const isActive = plan.id === activeTabId;
            const count = plan.selectedIds.length;
            const isEditing = editingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                onClick={() => {
                  if (!isEditing) switchPlan(plan.id);
                }}
                onDoubleClick={(e) => handleStartRename(plan.id, plan.name, e)}
                title="Nhấp đúp chuột hoặc bấm icon bút để đổi tên phương án"
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer whitespace-nowrap
                  transition-all duration-150 group relative text-xs sm:text-sm font-medium
                  ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border shadow-xs'
                  }
                `}
              >
                <Calendar className={`size-3.5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />

                {isEditing ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(plan.id, e)}
                      onBlur={() => handleSaveRename(plan.id)}
                      className="px-1.5 py-0.5 text-xs rounded bg-white text-slate-900 border border-blue-400 font-bold focus:outline-none w-28 sm:w-36 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(plan.id)}
                      className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                      title="Lưu tên"
                    >
                      <Check className="size-3.5 text-emerald-400" />
                    </button>
                  </div>
                ) : (
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{plan.name}</span>
                )}

                {/* Rename pencil icon button on hover */}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(plan.id, plan.name, e)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer ${
                      isActive ? 'hover:bg-white/20 text-white/90' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    title="Đổi tên phương án này"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}

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

                {plans.length > 1 && !isEditing && (
                  <button
                    type="button"
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
