const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/components/DkmhPortalView.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = '      {/* 3. MAIN WORKSPACE (SPLIT 7 / 5 LAYOUT) */}';
const endMarker = '      {/* SGU Error Diagnostic Breakdown Modal */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found! startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const newLayout = `      {/* 2. REGISTRATION ACTION & CONTROL DASHBOARD (Full Width) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Plan Selector & TKB Sync & Conditions Check */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-primary" />
              <span>Phương án TKB:</span>
            </span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border">
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPlanId(p.id);
                      loadPlanToQueue(p.id, enrolledCourses, true);
                    }}
                    className={\`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer \${
                      isSelected
                        ? 'bg-card text-foreground font-bold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }\`}
                    type="button"
                  >
                    {p.name} ({p.selectedIds.length} lớp)
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => loadPlanToQueue(selectedPlanId, enrolledCourses, true)}
              disabled={isSubmitting}
              className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              title="Đồng bộ lại từ thời khóa biểu"
              type="button"
            >
              <RotateCcw className="size-3" />
              <span>Nạp lại</span>
            </button>

            <button
              type="button"
              onClick={() => setAppViewMode('planner')}
              className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <BookOpen className="size-3" />
              <span>Đổi / Thêm môn từ TKB</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunDiagnostics}
              disabled={isCheckingDiagnostics || queue.length === 0}
              className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Quét điều kiện tiên quyết, giới hạn tín chỉ và trùng lịch trực tiếp từ API SGU"
              type="button"
            >
              {isCheckingDiagnostics ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="size-3.5" />
              )}
              <span>Kiểm tra điều kiện SGU</span>
            </button>
          </div>
        </div>

        {/* Row 2: Credit Progress + Delay Cadence + 7AM Auto-Schedule + Big Submit Action */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          {/* Card A: Credit Status */}
          <div className="lg:col-span-4 p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Layers className="size-4 text-primary" />
                <span>Tiến trình tín chỉ</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Tự do số TC
              </span>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: \`\${Math.min(100, Math.round((totalPlannedCredits / 25) * 100))}%\`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>Đã có: <strong className="text-foreground font-semibold">{totalEnrolledCredits} TC</strong></span>
                <span>Chờ nộp: <strong className="text-primary font-semibold">{totalQueueCredits} TC</strong></span>
                <span>Tổng: <strong className="text-emerald-400 font-semibold">{totalPlannedCredits} TC</strong></span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground m-0">
              Không ràng buộc tối thiểu / tối đa — hỗ trợ nộp bổ sung 1-2 TC tùy ý.
            </p>
          </div>

          {/* Card B: Delay Cadence & Speed */}
          <div className="lg:col-span-4 p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Clock className="size-4 text-primary" />
                <span>Nhịp gửi giữa các môn</span>
              </span>
              <span className="font-bold text-primary tabular-nums text-xs">
                {delaySeconds} giây/môn
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[
                { sec: 5, label: '5s (Chuẩn)' },
                { sec: 3, label: '3s' },
                { sec: 1, label: '1s' },
                { sec: 0, label: '0s' },
              ].map(({ sec, label }) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDelaySeconds(sec)}
                  className={\`py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border text-center \${
                    delaySeconds === sec
                      ? 'bg-primary text-primary-foreground border-primary font-bold shadow-2xs'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  }\`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground m-0">
              {delaySeconds === 5
                ? '5s mô phỏng chuẩn xác thao tác tay của sinh viên, đảm bảo an toàn 100%.'
                : delaySeconds === 0
                ? 'Gửi đồng loạt tối đa tốc độ ngay tại giây 00 mở cổng.'
                : \`Gửi tuần tự từng môn, cách nhau \${delaySeconds}s nhằm giữ nhịp độ tự nhiên.\`}
            </p>
          </div>

          {/* Card C: Auto-Schedule 07:00 & Submit Action CTA */}
          <div className="lg:col-span-4 p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between space-y-2.5">
            {/* Auto Schedule Switch */}
            <label className="flex items-center justify-between p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs font-semibold cursor-pointer">
              <span className="flex items-center gap-2 text-foreground">
                <Clock className="size-4 text-amber-500" />
                <span>Hẹn giờ tự gửi 07:00:00</span>
              </span>
              <div className="flex items-center gap-2">
                {autoSubmitAt7AM && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                    ĐÃ BẬT
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={autoSubmitAt7AM}
                  onChange={(e) => handleToggleAutoSubmitAt7AM(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                />
              </div>
            </label>

            {/* Big Submit Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmitSequential(false)}
                disabled={isSubmitting || queue.length === 0 || !token || allDone}
                className={\`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs \${
                  allDone
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-primary hover:bg-primary/90 active:scale-[0.99]'
                }\`}
                type="button"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Đang nộp ({delaySeconds}s/môn)...</span>
                  </span>
                ) : allDone ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-3.5" />
                    <span>Đã ghi nhận toàn bộ</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="size-3.5" />
                    <span>GỬI ĐĂNG KÝ HỌC PHẦN ({pendingQueueCount} môn)</span>
                  </span>
                )}
              </button>

              {isSubmitting && (
                <button
                  type="button"
                  onClick={() => {
                    stopSubmittingRef.current = true;
                    addLog('warn', 'Đã yêu cầu dừng tiến trình nộp môn.');
                  }}
                  className="py-2.5 px-3 rounded-xl font-bold text-xs bg-destructive text-destructive-foreground hover:opacity-90 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                >
                  <StopCircle className="size-3.5" />
                  <span>Dừng</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BẢNG 1: DANH SÁCH MÔN HỌC CHỜ ĐĂNG KÝ (FULL WIDTH TABLE - THONGTINDAOTAO STANDARD) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Send className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                Danh sách môn học chờ đăng ký (Hàng đợi nộp)
              </h3>
              <p className="text-xs text-muted-foreground m-0">
                Các môn học được chọn từ thời khóa biểu sẵn sàng nộp vào Cổng Đào Tạo SGU
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold tabular-nums">
              {queue.length} môn • {totalQueueCredits} tín chỉ
            </span>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-border rounded-xl bg-muted/10">
            <BookOpen className="size-7 mx-auto text-muted-foreground/50" />
            <p className="text-xs font-bold text-foreground">Hàng đợi đang trống</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Chưa có môn học nào trong danh sách. Hãy vào tab "Xếp Lịch Học" để chọn các môn bạn muốn đăng ký, hoặc bấm nút "Nạp lại" ở trên.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">STT</th>
                    <th className="py-3 px-3 w-24">Mã MH</th>
                    <th className="py-3 px-4 min-w-[220px]">Tên môn học</th>
                    <th className="py-3 px-3 text-center w-20">Nhóm/Tổ</th>
                    <th className="py-3 px-3 text-center w-16">Số TC</th>
                    <th className="py-3 px-4 min-w-[240px]">Lịch học (Thứ • Tiết • Phòng)</th>
                    <th className="py-3 px-3 text-center w-24">Còn lại</th>
                    <th className="py-3 px-3 text-center w-32">Trạng thái</th>
                    <th className="py-3 px-3 text-center w-16">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.map((item, idx) => {
                    const { group, status } = item;
                    const conflict = findConflictForGroup(group, queue, enrolledCourses);
                    const isFull = typeof group.sl_cl === 'number' && group.sl_cl <= 0;
                    return (
                      <tr key={\`\${group.id}-\${idx}\`} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 text-center text-muted-foreground font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-foreground">
                          {group.ma_mon}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-foreground m-0 text-xs leading-snug">
                            {group.ten_mon}
                          </p>
                          {conflict && (
                            <div className="text-[10px] text-amber-500 font-medium flex items-center gap-1 mt-1" title={\`Trùng lịch với \${conflict.withCourse}: \${conflict.time}\`}>
                              <AlertTriangle className="size-3 shrink-0" />
                              <span>Trùng lịch: {conflict.time}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-primary">
                          {group.nhom_to}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-foreground tabular-nums">
                          {group.so_tc}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {group.parsedSessions && group.parsedSessions.length > 0
                            ? group.parsedSessions.map((s) => (
                                <span key={\`\${s.thu}-\${s.tietStart}\`} className="inline-block mr-1.5 my-0.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] text-foreground font-medium">
                                  {s.thuStr || (s.thu === 8 ? 'CN' : \`Thứ \${s.thu}\`)} (T{s.tietStart}-{s.tietEnd}{s.phong ? \` • \${s.phong}\` : ''})
                                </span>
                              ))
                            : group.tkb_raw || 'Chưa xếp'}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">
                          {isFull ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                              Hết chỗ (0)
                            </span>
                          ) : (
                            <span className="text-emerald-500 font-bold tabular-nums">
                              {typeof group.sl_cl === 'number' ? group.sl_cl : '--'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {status === 'pending' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                              Chờ nộp
                            </span>
                          )}
                          {status === 'submitting' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                              <RefreshCw className="size-2.5 animate-spin" />
                              <span>Đang gửi...</span>
                            </span>
                          )}
                          {status === 'success' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle2 className="size-3" />
                              <span>Thành công</span>
                            </span>
                          )}
                          {status === 'error' && (
                            <button
                              type="button"
                              onClick={() => setSelectedErrorItem(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            >
                              <AlertCircle className="size-2.5" />
                              <span>{item.errorInfo?.badgeLabel || 'Lỗi SGU'}</span>
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(group.id)}
                            disabled={isSubmitting}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-30 transition-colors"
                            title="Xóa khỏi hàng đợi"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. BẢNG 2: KẾT QUẢ ĐĂNG KÝ HỌC PHẦN (CHÍNH THỨC CSDL SGU - FULL WIDTH) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Database className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                Kết quả đăng ký học phần (Đã ghi nhận trên CSDL SGU)
              </h3>
              <p className="text-xs text-muted-foreground m-0">
                Dữ liệu môn học chính thức truy vấn trực tiếp từ cổng đào tạo thongtindaotao.sgu.edu.vn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEnrolled()}
              disabled={isLoadingEnrolled || !token}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-muted/40 hover:bg-muted text-foreground cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
              type="button"
              title="Đồng bộ lại từ CSDL trường"
            >
              <RefreshCw className={\`size-3.5 \${isLoadingEnrolled ? 'animate-spin' : ''}\`} />
              <span>Đồng bộ từ SGU</span>
            </button>
          </div>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className="py-10 text-center space-y-1.5 border border-dashed border-border rounded-xl bg-muted/10">
            <BookOpen className="size-7 mx-auto text-muted-foreground/40" />
            <p className="text-xs font-bold text-foreground">Chưa có môn học nào được ghi nhận trên SGU</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Khi bạn bấm nộp hoặc khi cổng đào tạo ghi nhận thành công, các môn học sẽ hiển thị đầy đủ chi tiết tại bảng này.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">STT</th>
                    <th className="py-3 px-3 w-24">Mã MH</th>
                    <th className="py-3 px-4 min-w-[220px]">Tên môn học</th>
                    <th className="py-3 px-3 text-center w-20">Nhóm/Tổ</th>
                    <th className="py-3 px-3 text-center w-16">Số TC</th>
                    <th className="py-3 px-4 min-w-[200px]">Giảng viên</th>
                    <th className="py-3 px-3 text-center w-28">Ngày đăng ký</th>
                    <th className="py-3 px-3 text-center w-28">Trạng thái</th>
                    <th className="py-3 px-3 text-center w-20">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrolledCourses.map((c, idx) => (
                    <tr key={c.id_kqdk} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 text-center text-muted-foreground font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-foreground">
                        {c.ma_mon}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-foreground m-0 text-xs leading-snug">
                          {c.ten_mon}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-primary">
                        {c.nhom_to}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground tabular-nums">
                        {c.so_tc}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {c.ten_giang_vien || 'Theo kế hoạch'}
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-muted-foreground tabular-nums">
                        {c.ngay_dang_ky || 'Hôm nay'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" />
                          <span>Đã ghi nhận</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDropCourse(c)}
                          disabled={droppingCourseId === c.id_kqdk}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 cursor-pointer disabled:opacity-50 transition-colors"
                          title="Hủy môn này"
                          type="button"
                        >
                          {droppingCourseId === c.id_kqdk ? (
                            <RefreshCw className="size-3 animate-spin inline-block mr-1" />
                          ) : (
                            <Trash2 className="size-3 inline-block mr-1" />
                          )}
                          <span>Hủy</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold text-xs">
                    <td colSpan={4} className="py-3 px-4 text-foreground">
                      Tổng số môn học đã ghi nhận: <strong className="text-primary">{enrolledCourses.length} môn</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-primary text-sm tabular-nums">
                      {totalEnrolledCredits} TC
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-right text-muted-foreground">
                      Xác nhận chính thức từ máy chủ SGU
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. TIẾN TRÌNH & NHẬT KÝ TIẾP NHẬN TỪ MÁY CHỦ SGU */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                Tiến trình đăng ký &amp; Nhật ký máy chủ
              </h3>
              <p className="text-xs text-muted-foreground m-0">
                Theo dõi từng nhịp gửi và phản hồi chi tiết từ Cổng Đào Tạo SGU
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawLogs(!showRawLogs)}
              className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
              title="Chuyển đổi giao diện nhật ký"
            >
              {showRawLogs ? 'Giao diện thân thiện' : 'Chi tiết máy chủ'}
            </button>
            <button
              type="button"
              onClick={handleCopyLogs}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Sao chép nhật ký"
            >
              {isLogsCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
              title="Xóa nhật ký"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {!showRawLogs ? (
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border max-h-60 overflow-y-auto text-xs space-y-2 select-text">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-6 text-xs flex flex-col items-center justify-center gap-1">
                <Clock className="size-4 text-muted-foreground/50" />
                <span className="font-semibold">Chưa có lượt nộp môn nào</span>
                <span className="text-[11px] text-muted-foreground/70">Khi bấm đăng ký, tiến trình ghi nhận từng môn sẽ xuất hiện tại đây.</span>
              </div>
            ) : (
              logs.map((log) => {
                let containerStyle = 'bg-card border-border/80 text-foreground';
                let icon = <Info className="size-3.5 text-primary shrink-0 mt-0.5" />;

                if (log.type === 'success') {
                  containerStyle = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300';
                  icon = <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />;
                } else if (log.type === 'warn') {
                  containerStyle = 'bg-amber-500/10 border-amber-500/25 text-amber-300';
                  icon = <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />;
                } else if (log.type === 'error') {
                  containerStyle = 'bg-rose-500/10 border-rose-500/25 text-rose-300';
                  icon = <AlertCircle className="size-3.5 text-rose-400 shrink-0 mt-0.5" />;
                }

                return (
                  <div
                    key={log.id}
                    className={\`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all \${containerStyle}\`}
                  >
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-xs leading-snug break-words">
                          {log.text}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {log.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={terminalBottomRef} />
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-card border border-border max-h-60 overflow-y-auto font-mono text-[11px] space-y-1.5 select-text text-foreground">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                <span className="shrink-0 font-semibold uppercase">[{log.type}]</span>
                <span className="break-words">{log.text}</span>
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>
        )}
      </div>

`;

const updatedContent = content.substring(0, startIndex) + newLayout + content.substring(endIndex);
fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('Successfully updated DkmhPortalView.tsx with ThongTinDaoTao Pro Layout!');
