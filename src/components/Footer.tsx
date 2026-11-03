import React from 'react';
import { Eye, Github, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const [views, setViews] = React.useState<number>(1);

  React.useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem('sgu_tkb_views') || '1', 10);
      setViews(isNaN(stored) ? 1 : stored);
    } catch {
      setViews(1);
    }
  }, []);
  return (
    <footer className="w-full border-t border-border/40 bg-muted/20 backdrop-blur-sm mt-12 pb-24 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center gap-5 sm:gap-6 text-sm">
          {/* Tagline */}
          <div className="text-center space-y-2">
            <p className="text-muted-foreground max-w-lg leading-relaxed text-xs sm:text-sm">
              Công cụ hỗ trợ sinh viên sắp xếp thời khóa biểu thông minh, tránh xung đột lịch học của sinh viên
            </p>
          </div>

          {/* Sub Row: Copyright + View Counter + Version */}
          <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-2xl gap-3 sm:gap-4 text-label text-muted-foreground mt-2 pt-4 border-t font-mono text-xs">
            <span>© 2025 SVSGU - K23</span>

            {/* View Counter */}
            <div className="opacity-90">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border transition-colors">
                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-foreground font-mono">{views.toLocaleString('vi-VN')}</span>
                <span className="text-[11px] text-muted-foreground font-medium">lượt xem</span>
              </div>
            </div>

            {/* GitHub & Version */}
            <div className="flex items-center gap-2">
              <a
                href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                title="GitHub"
              >
                <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </a>
              <span className="bg-muted px-2 py-0.5 rounded-sm text-foreground">v2.1.0</span>
            </div>
          </div>

          {/* Developer Link */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-6 gap-y-2 text-label text-muted-foreground border-t pt-4 font-mono uppercase tracking-wider text-xs text-center">
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <span>Mọi thắc mắc xin hãy liên hệ qua nhà phát triển </span>
              <a
                href="https://nguyencongquan.id.vn/en"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary transition-colors decoration-primary/50 underline underline-offset-4 inline-flex items-center gap-1"
              >
                Quan
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

