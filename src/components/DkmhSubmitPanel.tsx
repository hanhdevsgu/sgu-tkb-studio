import { useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, XCircle, Trash2 } from "lucide-react";

/* ---------- Types ---------- */
export type ErrorKind = "prereq" | "full" | "conflict" | "credit" | "closed" | "unknown";
export type ItemStatus = "pending" | "sending" | "success" | "failed";

export interface QueueItem {
  id: string;
  code: string;
  name: string;
  group: string;
  credits: number;
  status: ItemStatus;
  errorKind?: ErrorKind;
  rawMessage?: string;
}

export type GateState = "open" | "closed" | "unknown";

interface Props {
  items: QueueItem[];
  gate: GateState;
  /** Số giây còn lại đến 07:00:00; null nếu không áp dụng */
  secondsToOpen: number | null;
  totalCredits: number;
  creditLimit: number;
  intervalSec: 0 | 1 | 3 | 5;
  onIntervalChange: (v: 0 | 1 | 3 | 5) => void;
  autoPilot: boolean;
  onAutoPilotChange: (v: boolean) => void;
  submitting: boolean;
  onSubmitAll: () => void;
  onRetryFailed: () => void;
  onRemoveItem?: (id: string) => void;
}

/* ---------- Error copy: nêu nguyên nhân + việc cần làm ---------- */
const ERROR_COPY: Record<ErrorKind, { title: string; action: string }> = {
  prereq: { title: "Chưa đạt môn tiên quyết", action: "Kiểm tra môn tiên quyết trong chương trình đào tạo, hoặc liên hệ cố vấn học tập." },
  full: { title: "Nhóm đã hết chỗ", action: "Chọn nhóm khác của cùng môn rồi gửi lại." },
  conflict: { title: "Trùng lịch học", action: "Đổi sang nhóm không trùng tiết với môn đã đăng ký." },
  credit: { title: "Vượt số tín chỉ tối đa", action: "Hủy bớt một môn hoặc bỏ môn này khỏi hàng đợi." },
  closed: { title: "Ngoài thời gian đăng ký", action: "Chờ cổng mở theo lịch của nhà trường rồi gửi lại." },
  unknown: { title: "Cổng đăng ký từ chối yêu cầu", action: "Đọc thông báo gốc bên dưới, hoặc sao chép nhật ký gửi cho bộ phận hỗ trợ." },
};

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
};

/* ---------- Status ---------- */
function StatusCell({ item }: { item: QueueItem }) {
  switch (item.status) {
    case "success":
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Đã đăng ký
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300">
          <XCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden /> {ERROR_COPY[item.errorKind ?? "unknown"].title}
        </span>
      );
    case "sending":
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} aria-hidden /> Đang gửi
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CircleDashed className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Chưa gửi
        </span>
      );
  }
}

/* ---------- Main ---------- */
export default function DkmhSubmitPanel({
  items,
  gate,
  secondsToOpen,
  totalCredits,
  creditLimit,
  intervalSec,
  onIntervalChange,
  autoPilot,
  onAutoPilotChange,
  submitting,
  onSubmitAll,
  onRetryFailed,
  onRemoveItem,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const counts = useMemo(
    () => ({
      success: items.filter((i) => i.status === "success").length,
      failed: items.filter((i) => i.status === "failed").length,
      pending: items.filter((i) => i.status === "pending").length,
    }),
    [items]
  );

  const overCredit = totalCredits > creditLimit;
  const blocked = items.length === 0 || overCredit;
  const gateLabel =
    gate === "open" ? "Cổng đăng ký đang mở" : gate === "closed" ? "Cổng đăng ký đang đóng" : "Chưa xác định trạng thái cổng";
  const gateTone =
    gate === "open"
      ? "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200"
      : gate === "closed"
      ? "border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
      : "border-border bg-muted text-muted-foreground";

  return (
    <section aria-label="Gửi đăng ký học phần" className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Dải trạng thái: 3 con số duy nhất cần nhìn lúc 07:00 */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-t-xl bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {secondsToOpen !== null && secondsToOpen > 0 ? "Còn lại đến 07:00:00" : "Cổng đăng ký"}
          </div>
          <div
            className="mt-1 font-mono text-4xl font-semibold leading-none tabular-nums text-foreground"
            role="timer"
            aria-live="off"
          >
            {secondsToOpen !== null && secondsToOpen > 0 ? fmt(secondsToOpen) : gate === "open" ? "Đang mở" : "Đã đóng"}
          </div>
          <span className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs font-medium ${gateTone}`}>{gateLabel}</span>
        </div>

        <div className="bg-card p-4">
          <div className="text-xs text-muted-foreground">Kết quả</div>
          <div className="mt-1 font-mono text-4xl font-semibold leading-none tabular-nums text-foreground">
            {counts.success}
            <span className="text-2xl text-muted-foreground">/{items.length}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {counts.failed > 0 ? (
              <span className="font-medium text-rose-700 dark:text-rose-300">{counts.failed} môn cần xử lý</span>
            ) : (
              `${counts.pending} môn chưa gửi`
            )}
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="text-xs text-muted-foreground">Tín chỉ trong hàng đợi</div>
          <div
            className={`mt-1 font-mono text-4xl font-semibold leading-none tabular-nums ${
              overCredit ? "text-rose-700 dark:text-rose-300" : "text-foreground"
            }`}
          >
            {totalCredits}
            <span className="text-2xl text-muted-foreground">/{creditLimit}</span>
          </div>
          {overCredit && (
            <div className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
              Vượt {totalCredits - creditLimit} tín chỉ. Bỏ bớt môn trước khi gửi.
            </div>
          )}
        </div>
      </div>

      {/* Hàng đợi */}
      <ul className="divide-y divide-border">
        {items.length === 0 && (
          <li className="p-6 text-sm text-muted-foreground">
            Hàng đợi trống. Chọn môn ở tab Xếp lịch học, các môn trong phương án đang chọn sẽ xuất hiện ở đây.
          </li>
        )}
        {items.map((item) => {
          const failed = item.status === "failed";
          const copy = ERROR_COPY[item.errorKind ?? "unknown"];
          return (
            <li key={item.id} className={failed ? "bg-rose-50/60 dark:bg-rose-400/5" : ""}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    {item.code} · Nhóm {item.group} · {item.credits} TC
                  </div>
                </div>
                <div className="text-sm">
                  <StatusCell item={item} />
                </div>
                {onRemoveItem && !submitting && item.status !== 'sending' && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer rounded-md hover:bg-rose-500/10"
                    title="Xóa môn này khỏi hàng đợi"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {failed && (
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === item.id ? null : item.id)}
                    aria-expanded={openId === item.id}
                    className="min-h-10 rounded-md px-3 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {openId === item.id ? "Ẩn chi tiết" : "Xem cách xử lý"}
                  </button>
                )}
              </div>
              {failed && openId === item.id && (
                <div className="border-t border-border bg-card px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">{copy.title}</p>
                  <p className="mt-1 text-muted-foreground">{copy.action}</p>
                  {item.rawMessage && (
                    <p className="mt-2 rounded bg-muted p-2 font-mono text-xs text-muted-foreground">{item.rawMessage}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Thiết lập: thu gọn, không tranh chấp sự chú ý với nút gửi */}
      <details className="border-t border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Tùy chọn gửi</summary>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <fieldset>
            <legend className="mb-1 text-xs text-muted-foreground">Khoảng cách giữa hai môn</legend>
            <div className="inline-flex overflow-hidden rounded-md border border-border" role="radiogroup">
              {([5, 3, 1, 0] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={intervalSec === v}
                  onClick={() => onIntervalChange(v)}
                  className={`min-h-10 min-w-12 border-r border-border px-3 font-mono text-sm tabular-nums last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    intervalSec === v ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  {v} giây
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={autoPilot}
              onChange={(e) => onAutoPilotChange(e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            Tự động gửi khi đến 07:00:00
          </label>
        </div>
      </details>

      {/* Thanh hành động: dính đáy trên mobile (vùng ngón cái), nằm cuối thẻ trên desktop */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:p-4">
        <button
          type="button"
          disabled={blocked || submitting}
          onClick={() => (counts.pending + counts.failed > 0 && gate !== "open" ? setConfirmPending(true) : onSubmitAll())}
          className="min-h-14 flex-1 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform duration-150 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-w-64"
        >
          {submitting ? "Đang gửi…" : `Gửi ${items.length} môn đăng ký`}
        </button>
        {counts.failed > 0 && !submitting && (
          <button
            type="button"
            onClick={onRetryFailed}
            className="min-h-14 rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Gửi lại {counts.failed} môn lỗi
          </button>
        )}
      </div>

      {/* Xác nhận khi cổng chưa mở: tránh gửi nhầm, đồng thời giải thích hậu quả */}
      {confirmPending && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 id="confirm-title" className="text-base font-semibold text-foreground">Cổng đăng ký chưa mở</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Nếu gửi bây giờ, cổng sẽ từ chối toàn bộ môn. Bạn có thể bật “Tự động gửi khi đến 07:00:00” để hệ thống gửi đúng giờ.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmPending(false)} className="min-h-12 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary">
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmPending(false);
                  onSubmitAll();
                }}
                className="min-h-12 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Vẫn gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
