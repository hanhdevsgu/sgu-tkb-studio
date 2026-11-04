import React, { useState, useEffect, useRef } from 'react';
import { Target, Shield, Volume2, VolumeX, Square, Clock, Zap } from 'lucide-react';
import { ClassGroup } from '../types/course';
import { SguDkmhService } from '../services/sguDkmhService';

export interface SlotSniperCardProps {
  token: string | null;
  targetGroup: ClassGroup | null;
  onClearTarget: () => void;
  onSuccess: (group: ClassGroup) => void;
  availableQueueGroups: ClassGroup[];
  onSelectTarget: (group: ClassGroup) => void;
  addLog: (type: 'info' | 'success' | 'warn' | 'error', text: string) => void;
}

export function playSniperSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major arpeggio chime)
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.35);
    });
  } catch {}
}

export const SlotSniperCard: React.FC<SlotSniperCardProps> = ({
  token,
  targetGroup,
  onClearTarget,
  onSuccess,
  availableQueueGroups,
  onSelectTarget,
  addLog,
}) => {
  // Config state
  const [intervalSec, setIntervalSec] = useState<number>(5); // 3, 5, 8
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Runtime state
  const [isActive, setIsActive] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastMessage, setLastMessage] = useState<string>('Chưa khởi động');
  const [lastAttemptTime, setLastAttemptTime] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const stopSignalRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer ticker
  useEffect(() => {
    if (isActive) {
      setElapsedSec(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isActive]);

  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartSniper = async () => {
    if (!token) {
      addLog('error', '[Săn Slot] Yêu cầu đăng nhập tài khoản sinh viên SGU trước khi săn slot.');
      return;
    }
    if (!targetGroup) {
      addLog('warn', '[Săn Slot] Vui lòng chọn môn học cần tranh giành slot.');
      return;
    }

    stopSignalRef.current = false;
    setIsActive(true);
    setIsSuccess(false);
    setAttempts(0);
    setLastMessage('Bắt đầu khởi động radar canh slot...');

    const id_to_hoc = targetGroup.id_to_hoc || targetGroup.id;
    addLog('warn', `🎯 BẮT ĐẦU SĂN SLOT: [${targetGroup.ma_mon} - Nhóm ${targetGroup.nhom_to}] ${targetGroup.ten_mon} (Chu kỳ ${intervalSec}s/lần, nhịp an toàn)...`);

    let count = 0;

    while (!stopSignalRef.current) {
      count++;
      setAttempts(count);
      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      setLastAttemptTime(timeStr);

      try {
        setLastMessage(`Lần #${count} (${timeStr}): Đang gửi request kiểm tra & chiếm chỗ...`);
        const res = await SguDkmhService.registerSingleCourse(token, id_to_hoc);

        // Trường hợp 1: Đăng ký thành công hoặc môn đã có trong danh sách
        if (res.success || res.parsedError?.category === 'DA_DANG_KY') {
          setIsSuccess(true);
          setIsActive(false);
          stopSignalRef.current = true;

          const successMsg = `🎉 CHIẾM ĐƯỢC CHỖ THÀNH CÔNG môn [${targetGroup.ma_mon} - Nhóm ${targetGroup.nhom_to}] ${targetGroup.ten_mon}!`;
          setLastMessage(successMsg);
          addLog('success', successMsg);

          if (soundEnabled) {
            playSniperSuccessSound();
          }

          onSuccess(targetGroup);
          break;
        }

        // Trường hợp 2: Lớp vẫn đang hết chỗ (HET_CHO) -> Tiếp tục canh nhả môn
        if (res.parsedError?.category === 'HET_CHO' || (res.message && res.message.toLowerCase().includes('hết chỗ'))) {
          // Tính jitter ngẫu nhiên +/- 350ms để tuyệt đối không có mẫu định kỳ
          const jitter = Math.floor(Math.random() * 700) - 350;
          const waitMs = Math.max(2500, intervalSec * 1000 + jitter);
          const waitDisplay = (waitMs / 1000).toFixed(1);

          setLastMessage(`Lần #${count}: Lớp vẫn đầy (0 chỗ). Đang canh người nhả... Chờ ${waitDisplay}s`);
          addLog('info', `[Săn Slot #${count}] ${targetGroup.ma_mon} Nhóm ${targetGroup.nhom_to}: Vẫn đầy. Nghỉ ${waitDisplay}s trước lần tiếp theo...`);

          // Chờ theo chu kỳ (ngắt ngay lập tức nếu người dùng bấm Dừng)
          const startWait = Date.now();
          while (Date.now() - startWait < waitMs) {
            if (stopSignalRef.current) break;
            await new Promise((r) => setTimeout(r, 100));
          }
        } else {
          // Trường hợp 3: Lỗi khác (Trùng lịch, Vượt tín chỉ, Tiên quyết, Cổng đóng...)
          setIsActive(false);
          stopSignalRef.current = true;
          const errMsg = `⚠️ Tạm dừng săn slot do vi phạm điều kiện SGU: ${res.message}`;
          setLastMessage(errMsg);
          addLog('error', errMsg);
          break;
        }
      } catch (err: any) {
        addLog('warn', `[Săn Slot #${count}] Lỗi mạng tạm thời: ${err.message}. Thử lại sau 4s...`);
        const startWait = Date.now();
        while (Date.now() - startWait < 4000) {
          if (stopSignalRef.current) break;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    setIsActive(false);
  };

  const handleStopSniper = () => {
    stopSignalRef.current = true;
    setIsActive(false);
    setLastMessage('Đã dừng chế độ săn slot theo yêu cầu người dùng.');
    addLog('info', '[Săn Slot] Đã dừng tiến trình tranh giành slot.');
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Target className={`size-4 ${isActive ? 'animate-spin text-amber-500' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Chế độ Săn Slot / Tranh Giành Chỗ Trống (Slot Sniper)
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Canh người nhả môn
              </span>
            </div>
            <p className="text-xs text-muted-foreground m-0">
              Tự động kiểm tra và chiếm chỗ ngay lập tức khi có sinh viên khác nhả lớp. Tần suất an toàn, không bị trường phạt spam.
            </p>
          </div>
        </div>

        {/* Safe rate limit badge */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
          <Shield className="size-3.5 text-emerald-500 shrink-0" />
          <span>Tốc độ: <strong className="text-foreground font-mono">~{Math.round(60 / intervalSec)} req/phút</strong> (Cực an toàn)</span>
        </div>
      </div>

      {/* Target Subject Selector & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Target selection & status */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Môn học mục tiêu cần săn:
            </span>
            {targetGroup && !isActive && (
              <button
                type="button"
                onClick={onClearTarget}
                className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Đổi môn khác
              </button>
            )}
          </div>

          {targetGroup ? (
            <div className={`p-3.5 rounded-xl border transition-all ${
              isActive
                ? 'border-amber-500/40 bg-amber-500/5'
                : isSuccess
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-border bg-muted/30'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-background border border-border text-foreground">
                      {targetGroup.ma_mon}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      Nhóm {targetGroup.nhom_to}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {targetGroup.so_tc} tín chỉ
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-sm font-semibold text-foreground truncate">
                    {targetGroup.ten_mon}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lớp: {targetGroup.lop || 'Toàn trường'} • Phòng/GV: {targetGroup.parsedSessions?.[0]?.phong || 'Chưa xếp'} ({targetGroup.parsedSessions?.[0]?.gv || 'Chưa xếp'})
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[11px] text-muted-foreground">Chỗ còn lại</div>
                  <div className={`text-base font-mono font-bold tabular-nums ${
                    (targetGroup.sl_cl ?? 0) > 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {targetGroup.sl_cl ?? 0}/{targetGroup.sl_cp ?? 0}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Chưa có môn mục tiêu. Chọn nhanh từ hàng đợi hoặc bấm "🎯 Săn slot" bên cạnh môn bị hết chỗ:
              </p>
              {availableQueueGroups.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {availableQueueGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSelectTarget(g)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>{g.ma_mon} (N{g.nhom_to})</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  (Nạp môn vào hàng đợi trước để chọn môn cần săn slot)
                </p>
              )}
            </div>
          )}

          {/* Real-time Telemetry Bar */}
          <div className="p-3 rounded-xl border border-border bg-muted/40 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="size-3.5 text-primary" />
                <span>Nhật ký radar:</span>
              </span>
              {lastAttemptTime && (
                <span className="font-mono text-[11px] text-foreground/80">Lần cuối: {lastAttemptTime}</span>
              )}
            </div>
            <p className="font-mono text-xs text-foreground/90 bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/80 truncate">
              {lastMessage}
            </p>
          </div>
        </div>

        {/* Right: Controls & Counters */}
        <div className="lg:col-span-5 flex flex-col justify-between p-3.5 rounded-xl border border-border bg-muted/25 space-y-3.5">
          {/* Counters: Attempts & Elapsed Time */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-lg border border-border bg-card">
              <div className="text-[11px] text-muted-foreground">Số lần thử</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-foreground mt-0.5">
                {attempts}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-card">
              <div className="text-[11px] text-muted-foreground">Thời gian canh</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-primary mt-0.5">
                {formatElapsed(elapsedSec)}
              </div>
            </div>
          </div>

          {/* Config: Interval & Sound */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Chu kỳ quét:</span>
              <div className="inline-flex rounded-lg border border-border overflow-hidden" role="radiogroup">
                {([3, 5, 8] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={isActive}
                    onClick={() => setIntervalSec(sec)}
                    className={`px-2.5 py-1 font-mono text-xs tabular-nums cursor-pointer transition-colors ${
                      intervalSec === sec
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {sec}s {sec === 5 ? '(Chuẩn)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Chuông báo khi chiếm được chỗ:</span>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  soundEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                <span>{soundEnabled ? 'Bật chuông' : 'Tắt tiếng'}</span>
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <div>
            {!isActive ? (
              <button
                type="button"
                disabled={!targetGroup || !token}
                onClick={handleStartSniper}
                className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
              >
                <Zap className="size-4 fill-white" />
                <span>Bắt đầu săn slot môn này</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopSniper}
                className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-xs cursor-pointer transition-all active:scale-[0.99]"
              >
                <Square className="size-4 fill-white" />
                <span>Dừng săn slot</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
