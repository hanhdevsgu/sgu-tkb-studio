import React, { useState } from 'react';
import { X, Copy, Check, Zap, HelpCircle, Upload } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';
import { parseTkbString } from '../utils/tkbParser';
import { ClassGroup, ScheduleSession, SubjectSummary } from '../types/course';
import { parseDayOfWeek, parsePeriodString, cleanVietnameseSubjectTitle } from '../utils/sguDataLoader';

interface SguApiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SguApiImportModal: React.FC<SguApiImportModalProps> = ({ isOpen, onClose }) => {
  const { setToastMessage } = useTimetableStore();
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const scriptCode = `(async () => {
  const user = JSON.parse(sessionStorage.getItem("CURRENT_USER") || "{}");
  if (!user.access_token) return alert("❌ Bạn chưa đăng nhập tài khoản SGU!");
  console.log("⏳ Đang quét danh sách môn học...");
  const res = await fetch("/api/dkmh/w-locdsnhomto", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "idpc": "0",
      "Authorization": "Bearer " + user.access_token
    },
    body: JSON.stringify({
      is_CVHT: false,
      additional: { paging: { limit: 99999, page: 1 }, ordering: [{ name: "", order_type: "" }] }
    })
  });
  const json = await res.json();
  if (json.data) {
    copy(JSON.stringify(json.data));
    alert("✅ Đã sao chép toàn bộ dữ liệu môn học SGU vào Clipboard! Hãy dán vào Web TKB.");
  }
})();`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setToastMessage('Đã sao chép mã quét vào clipboard!');
    });
  };

  const handleProcessImport = () => {
    setErrorMsg(null);
    const raw = jsonInput.trim();
    if (!raw) {
      setErrorMsg('Vui lòng dán dữ liệu JSON trước khi nạp!');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      let rawList: any[] = [];
      let subjectMap: Record<string, string> = {};

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed.ds_nhom_to && Array.isArray(parsed.ds_nhom_to)) {
        rawList = parsed.ds_nhom_to;
        if (parsed.ds_mon_hoc && Array.isArray(parsed.ds_mon_hoc)) {
          parsed.ds_mon_hoc.forEach((m: any) => {
            if (m.ma) subjectMap[m.ma] = m.ten;
          });
        }
      } else if (parsed.data && parsed.data.ds_nhom_to) {
        rawList = parsed.data.ds_nhom_to;
        if (parsed.data.ds_mon_hoc && Array.isArray(parsed.data.ds_mon_hoc)) {
          parsed.data.ds_mon_hoc.forEach((m: any) => {
            if (m.ma) subjectMap[m.ma] = m.ten;
          });
        }
      }

      if (rawList.length === 0) {
        setErrorMsg('Không tìm thấy danh sách nhóm tổ hợp lệ trong JSON.');
        return;
      }

      const seenGroupIds = new Set<string>();
      const importedGroups: ClassGroup[] = rawList.map((item, idx) => {
        const maMon = String(item.ma_mon || '').normalize('NFC').trim();
        const rawTenMon = subjectMap[maMon] || item.ten_mon || `Môn ${maMon}`;
        const tenMon = cleanVietnameseSubjectTitle(rawTenMon);
        const nhomTo = String(item.nhom_to ?? item.to_hoc ?? '').normalize('NFC').trim();
        const toHoc = String(item.to ?? '').normalize('NFC').trim();
        const rawIdToHoc = String(item.id_to_hoc || item.id || `${maMon}_${nhomTo}`);
        let uniqueRowId = rawIdToHoc;
        if (seenGroupIds.has(uniqueRowId)) {
          uniqueRowId = `${rawIdToHoc}__to_${toHoc || idx}`;
        }
        seenGroupIds.add(uniqueRowId);

        const soTc = Number(item.so_tc ?? item.so_tc_so ?? 0) || 0;
        const slCp = Number(item.sl_cp ?? 0) || 0;
        const slCl = typeof item.sl_cl === 'number' ? item.sl_cl : Number(item.sl_cl ?? 0) || 0;
        const slDk = item.sl_dk != null ? Number(item.sl_dk) : Math.max(0, slCp - slCl);
        const dsLop = Array.isArray(item.ds_lop) ? item.ds_lop : item.lop ? [item.lop] : [];
        const lop = dsLop.length > 0 ? dsLop.join(', ') : item.lop || '';
        const dsKhoa = Array.isArray(item.ds_khoa) ? item.ds_khoa : [];

        let sessions: ScheduleSession[] = [];
        if (Array.isArray(item.tkb)) {
          sessions = item.tkb.map((t: any) => {
            const thu = parseDayOfWeek(t.thu);
            const { start, end, count } = parsePeriodString(t.thoi_gian);
            const isUnscheduled = thu === 0 || start === 0;
            return {
              thu,
              thuStr: isUnscheduled ? 'Chưa xếp' : (t.thu || `Thứ ${thu}`),
              thoi_gian: isUnscheduled ? 'Chưa xếp' : (t.thoi_gian || ''),
              tietStart: start,
              tietEnd: end,
              soTiet: count,
              phong: t.phong || 'Chưa xếp',
              gv: t.giang_vien || 'Chưa phân công',
              dates: t.ngay || '',
              isUnscheduled,
            };
          });
        } else if (typeof item.tkb === 'string') {
          sessions = parseTkbString(item.tkb);
        }

        const isUnscheduled = sessions.length === 0 || sessions.every((s) => s.isUnscheduled || s.thu === 0 || !s.tietStart);

        return {
          id: uniqueRowId,
          id_to_hoc: rawIdToHoc,
          ma_mon: maMon,
          ten_mon: tenMon,
          to_hoc: toHoc,
          to: toHoc,
          nhom_to: nhomTo,
          so_tc: soTc,
          sl_cp: slCp,
          sl_cl: slCl,
          sl_dk: slDk,
          lop,
          ds_lop: dsLop,
          ds_khoa: dsKhoa,
          tkb_raw: typeof item.tkb === 'string' ? item.tkb : JSON.stringify(item.tkb || ''),
          parsedSessions: sessions,
          isUnscheduled,
        };
      });

      // Update in Zustand store
      const subMap = new Map<string, SubjectSummary>();
      for (const g of importedGroups) {
        const existing = subMap.get(g.ma_mon);
        if (!existing) {
          subMap.set(g.ma_mon, {
            ma_mon: g.ma_mon,
            ten_mon: g.ten_mon,
            so_tc: g.so_tc,
            groupCount: 1,
          });
        } else {
          existing.groupCount += 1;
        }
      }

      const subjects = Array.from(subMap.values()).sort((a, b) =>
        a.ten_mon.localeCompare(b.ten_mon, 'vi')
      );

      // Merge with existing state
      useTimetableStore.setState({
        allCourses: importedGroups,
        allSubjects: subjects,
        selectedSubjectCode: subjects[0]?.ma_mon || null,
      });

      setToastMessage(`Đã nạp thành công ${importedGroups.length} nhóm lớp!`);
      onClose();
    } catch (e: any) {
      setErrorMsg(`Lỗi định dạng JSON: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border border-border rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-foreground text-lg">
              Nhập dữ liệu thời khóa biểu
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Instruction box */}
          <div className="p-4 bg-muted/50 border border-border rounded-none space-y-2.5">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-primary" />
                Hướng dẫn nạp dữ liệu từ trang Đào tạo SGU:
              </span>
              <button
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Đã sao chép' : 'Sao chép đoạn mã'}
              </button>
            </div>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
              <li>Đăng nhập vào <b>dkmh.sgu.edu.vn</b> (hoặc <b>thongtindaotao.sgu.edu.vn</b>)</li>
              <li>Bấm <b>F12</b> (hoặc chuột phải chọn Kiểm tra) &rarr; chọn tab <b>Console</b></li>
              <li>Bấm nút <b>Sao chép đoạn mã</b> ở trên, dán vào và nhấn <b>Enter</b></li>
              <li>Dữ liệu tự động được sao chép vào bộ nhớ &rarr; Dán vào ô bên dưới</li>
            </ol>
          </div>

          {/* Paste Area */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
              Dán dữ liệu JSON môn học tại đây:
            </label>
            <textarea
              rows={8}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Dán JSON chứa { ds_nhom_to, ds_mon_hoc } hoặc mảng _dkmhData vào đây..."
              className="w-full p-3 bg-background border border-border text-foreground font-mono text-xs focus:outline-hidden focus:border-primary resize-none"
            />
            {errorMsg && (
              <p className="text-xs text-rose-500 font-medium">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium border border-border hover:bg-muted text-foreground cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handleProcessImport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Nạp dữ liệu ngay
          </button>
        </div>
      </div>
    </div>
  );
};
