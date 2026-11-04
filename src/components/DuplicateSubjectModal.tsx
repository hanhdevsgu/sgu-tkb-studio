import React, { useMemo } from 'react';
import { X, AlertTriangle, Check, BookOpen, Users, GraduationCap, ChevronRight } from 'lucide-react';
import { SubjectSummary, ClassGroup } from '../types/course';

interface DuplicateSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubjectCode: string | null;
  allSubjects: SubjectSummary[];
  allCourses: ClassGroup[];
  onSelectSubject: (code: string) => void;
}

export const DuplicateSubjectModal: React.FC<DuplicateSubjectModalProps> = ({
  isOpen,
  onClose,
  currentSubjectCode,
  allSubjects,
  allCourses,
  onSelectSubject,
}) => {
  const currentSubject = useMemo(() => {
    if (!currentSubjectCode) return null;
    return allSubjects.find((s) => s.ma_mon === currentSubjectCode) || null;
  }, [currentSubjectCode, allSubjects]);

  // Tìm tất cả các môn có cùng tên chuẩn hóa với môn hiện tại
  const matchingVariants = useMemo(() => {
    if (!currentSubject) return [];
    const targetName = currentSubject.ten_mon.trim().toLowerCase();
    return allSubjects.filter(
      (s) => s.ten_mon.trim().toLowerCase() === targetName
    );
  }, [currentSubject, allSubjects]);

  // Chi tiết từng nhóm lớp của các biến thể
  const variantDetails = useMemo(() => {
    return matchingVariants.map((subj) => {
      const groups = allCourses.filter((c) => c.ma_mon === subj.ma_mon);
      const totalCp = groups.reduce((acc, g) => acc + g.sl_cp, 0);
      const totalCl = groups.reduce((acc, g) => acc + g.sl_cl, 0);
      const totalDk = groups.reduce(
        (acc, g) => acc + (g.sl_dk != null ? g.sl_dk : Math.max(0, g.sl_cp - g.sl_cl)),
        0
      );

      // Thu thập danh sách lớp đối tượng
      const targetClassesSet = new Set<string>();
      groups.forEach((g) => {
        if (g.lop && g.lop !== '*') targetClassesSet.add(g.lop);
        (g.ds_lop || []).forEach((l) => {
          if (l && l !== '*') targetClassesSet.add(l);
        });
      });

      // Thu thập danh sách khoa/bộ môn
      const deptsSet = new Set<string>();
      groups.forEach((g) => {
        (g.ds_khoa || []).forEach((k) => {
          if (k) deptsSet.add(k);
        });
      });

      return {
        subject: subj,
        groups,
        totalCapacity: totalCp,
        totalRemaining: totalCl,
        totalRegistered: totalDk,
        targetClasses: Array.from(targetClassesSet),
        departments: Array.from(deptsSet),
        isCurrent: subj.ma_mon === currentSubjectCode,
      };
    });
  }, [matchingVariants, allCourses, currentSubjectCode]);

  if (!isOpen || !currentSubject || variantDetails.length <= 1) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-duplicate-title"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 id="modal-duplicate-title" className="text-base font-bold text-foreground">
                Phân biệt môn trùng tên: “{currentSubject.ten_mon}”
              </h2>
              <p className="text-xs text-muted-foreground">
                Hệ thống phát hiện {variantDetails.length} mã học phần khác nhau có cùng tên. Hãy kiểm tra đối tượng lớp và số tín chỉ để chọn đúng mã của ngành bạn!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body: Side-by-side Columns */}
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variantDetails.map((item) => {
              const { subject, totalCapacity, totalRemaining, totalRegistered, targetClasses, departments, isCurrent } = item;
              const isMajor = subject.scope === 'major';

              return (
                <div
                  key={subject.ma_mon}
                  className={`relative flex flex-col rounded-xl border p-4 transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  {/* Badge & Code */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                        {subject.ma_mon}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                          isMajor
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        {isMajor ? 'Chuyên ngành' : 'Chung toàn trường'}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Đang chọn
                      </span>
                    )}
                  </div>

                  {/* Title & Credits */}
                  <h3 className="text-base font-bold text-foreground mb-1 leading-snug">
                    {subject.ten_mon}
                  </h3>
                  <div className="text-xs text-muted-foreground mb-4">
                    Số tín chỉ: <strong className="text-foreground font-mono">{subject.so_tc} TC</strong>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-lg bg-muted/40 border border-border/50 mb-4 text-center">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Nhóm mở</div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {item.groups.length} nhóm
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Đã đăng ký</div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {totalRegistered}/{totalCapacity}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Còn chỗ</div>
                      <div
                        className={`font-mono text-sm font-bold ${
                          totalRemaining <= 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : totalRemaining <= 5
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {totalRemaining}
                      </div>
                    </div>
                  </div>

                  {/* Target Classes */}
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Lớp sinh viên được mở (Lớp đích):</span>
                    </div>
                    {targetClasses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {targetClasses.map((cls) => (
                          <span
                            key={cls}
                            className="font-mono text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium border border-border/50"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">
                        Mở tự do toàn trường (hoặc không ghi cụ thể mã lớp)
                      </div>
                    )}

                    {departments.length > 0 && (
                      <div className="pt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>Khoa / Viện: <strong>{departments.join(', ')}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSubject(subject.ma_mon);
                      onClose();
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'
                    }`}
                  >
                    {isCurrent ? (
                      <>
                        <Check className="h-4 w-4" /> Đang xem mã này
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4" /> Chuyển sang mã {subject.ma_mon}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* SGU Rule notice */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Lưu ý quan trọng từ Cổng SGU:
            </div>
            <p>
              Nếu bạn chọn sai mã môn học (ví dụ: sinh viên ngành CNTT chọn nhầm mã môn Cấu trúc dữ liệu dành cho khối ngành Sư phạm hoặc Kinh tế), điểm học phần có thể <strong>không được công nhận vào chương trình đào tạo chuẩn</strong> hoặc bị chặn đăng ký vì sai danh sách lớp đích. Hãy ưu tiên chọn mã có danh sách <strong>Lớp sinh viên</strong> khớp với lớp niên chế của bạn!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 bg-muted/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium rounded-xl border border-border bg-card hover:bg-secondary text-foreground cursor-pointer transition-colors"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
