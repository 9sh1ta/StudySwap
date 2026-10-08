import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import './components/ui/ui.css';
import './components/domain/domain.css';
import './styles/phase5.css';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ExamModeProvider } from './context/ExamModeContext.jsx';
import * as api from './api/client.js';

// Dev only: poke the mock database from the browser console, e.g.
//   await studyswap.ratings.create({ material_id: 1002, rated_by: 103, score: 7 })
if (import.meta.env.DEV) window.studyswap = api;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ExamModeProvider>
              <App />
            </ExamModeProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
