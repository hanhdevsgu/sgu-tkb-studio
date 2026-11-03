import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useTimetableStore } from './store/useTimetableStore';

(window as any).__TKB_STORE__ = useTimetableStore;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
