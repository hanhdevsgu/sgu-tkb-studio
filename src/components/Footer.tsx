import React from 'react';
import { SguLogo } from './SguLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-border/60 bg-card/40 backdrop-blur-sm mt-12 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          {/* Left: Branding */}
          <div className="flex items-center gap-2.5">
            <SguLogo size={24} />
            <span className="font-semibold text-foreground font-sans tracking-tight">
              SGU Timetable Studio
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span>Hệ thống xếp thời khóa biểu thông minh</span>
          </div>

          {/* Right: Security & Sync note */}
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground/80">
            <span>Tự động đồng bộ Live Slot</span>
            <span>•</span>
            <span className="text-emerald-500 font-medium">Bảo mật dữ liệu 100%</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
