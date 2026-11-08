import React, { useEffect, useRef } from 'react';
import { useTimetableStore } from './store/useTimetableStore';
import { useBackgroundSync } from './hooks/useBackgroundSync';
import { Header } from './components/Header';
import { VersionTabs } from './components/VersionTabs';
import { SubjectSelectorCard } from './components/SubjectSelectorCard';
import { TimetableCard } from './components/TimetableCard';
import { DkmhPortalView } from './components/DkmhPortalView';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';

export const App: React.FC = () => {
  const { initData, importScheduleJson, appViewMode } = useTimetableStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kích hoạt đồng bộ CSDL SGU ngầm liên tục không reload trang
  useBackgroundSync();

  useEffect(() => {
    initData();
  }, [initData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importScheduleJson(json);
      } catch (err) {
        console.error(err);
        useTimetableStore.getState().setToastMessage('❌ File JSON không đúng định dạng!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* Top Application Header */}
      <Header />

      {/* Hidden File Input for JSON restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Main Container depending on View Mode */}
      {appViewMode === 'dkmh' ? (
        <main className="flex-1 w-full animate-in fade-in-50 duration-200">
          <DkmhPortalView />
        </main>
      ) : (
        <main className="flex-1 w-full animate-in fade-in-50 duration-200">
          {/* Version Tabs Bar */}
          <VersionTabs />

          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Card 1: Subject Selector & Group Table */}
            <SubjectSelectorCard />

            {/* Card 2: Interactive Timetable Grid & Selected List */}
            <TimetableCard onTriggerUpload={triggerUpload} />
          </div>
        </main>
      )}

      {/* Footer */}
      <Footer />

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
};

export default App;
