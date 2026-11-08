import { useEffect, useRef } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

/**
 * Hook quản lý đồng bộ dữ liệu SGU ngầm liên tục (Zero-reload, Không mất cache, Không gián đoạn UI)
 * - Tự động đối chiếu metadata CSDL ngầm mỗi 30 giây
 * - Tự động đồng bộ ngay khi người dùng chuyển tab quay lại (visibilitychange)
 * - Cập nhật trực tiếp số lượng chỗ còn lại (sl_cl, sl_dk) trong RAM mà KHÔNG reload trang
 */
export function useBackgroundSync() {
  const syncCatalogData = useTimetableStore((s) => s.syncCatalogData);
  const lastSyncTime = useTimetableStore((s) => s.lastSyncTime);
  const lastCheckTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // 1. Kiểm tra và đồng bộ ngầm lần đầu sau 1.5 giây
    const initialTimer = setTimeout(() => {
      syncCatalogData(true);
      lastCheckTimeRef.current = Date.now();
    }, 1500);

    // 2. Định kỳ kiểm tra metadata mới mỗi 30 giây
    const intervalTimer = setInterval(() => {
      syncCatalogData(true);
      lastCheckTimeRef.current = Date.now();
    }, 30 * 1000);

    // 3. Tự động kiểm tra ngay khi sinh viên quay lại tab trình duyệt
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastCheckTimeRef.current;
        // Nếu đã hơn 15 giây kể từ lần kiểm tra gần nhất, quét ngầm ngay
        if (elapsed > 15 * 1000) {
          syncCatalogData(true);
          lastCheckTimeRef.current = Date.now();
        }
      }
    };

    // 4. Tự động kiểm tra khi kết nối mạng được phục hồi
    const handleOnline = () => {
      syncCatalogData(true);
      lastCheckTimeRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [syncCatalogData]);

  return { lastSyncTime };
}
