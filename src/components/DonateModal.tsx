import React from 'react';
import { Coffee, Heart, X } from 'lucide-react';
import { useTimetableStore } from '../store/useTimetableStore';

export const DonateModal: React.FC = () => {
  const { isDonateModalOpen, setDonateModalOpen } = useTimetableStore();

  if (!isDonateModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={() => setDonateModalOpen(false)}
      />

      {/* Modal Dialog */}
      <div className="bg-background relative z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-md gap-4 border border-border p-6 shadow-lg duration-200 rounded-none animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <h2 className="font-semibold flex items-center gap-2 text-xl text-foreground">
            <Coffee className="w-5 h-5 text-amber-600" />
            Ủng hộ dự án
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nếu bạn thấy công cụ này hữu ích, hãy ủng hộ chúng mình một ly cà phê để duy trì và phát triển thêm nhiều tính năng mới nhé!
          </p>

          <div className="flex justify-center py-2">
            <div className="bg-white p-2 sm:p-4 border-2 border-border inline-block rounded-lg max-w-full">
              <img
                alt="VietQR Code"
                className="w-56 h-56 sm:w-80 sm:h-80 max-w-full object-contain mx-auto"
                src="https://img.vietqr.io/image/970415-104875883096-compact.png?amount=&addInfo=Ung%20ho%20TKB%20SGU&accountName=NGUYEN%20CONG%20QUAN"
              />
            </div>
          </div>

          <div className="bg-muted border border-border p-4 space-y-2 rounded-md">
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Số tài khoản
              </span>
              <span className="text-sm font-mono font-bold text-foreground">
                104875883096
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Chủ tài khoản
              </span>
              <span className="text-sm font-bold text-foreground">
                NGUYEN CONG QUAN
              </span>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 flex items-start gap-2 rounded-md">
            <Heart className="w-4 h-4 text-amber-600 dark:text-amber-500 fill-amber-600 dark:fill-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Mọi đóng góp của bạn đều giúp chúng mình có động lực để tiếp tục phát triển và cải thiện công cụ. Cảm ơn bạn rất nhiều! ❤️
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setDonateModalOpen(false)}
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-4 py-2 gap-2 cursor-pointer rounded-none text-foreground"
            type="button"
          >
            <X className="w-4 h-4" />
            Đóng
          </button>
        </div>

        {/* Close Icon Top Right */}
        <button
          onClick={() => setDonateModalOpen(false)}
          className="absolute top-4 right-4 opacity-70 hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

