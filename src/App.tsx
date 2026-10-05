/**
 * Routes:
 *   /          parent booking flow (share this link / QR code)
 *   /my        parent's own schedule
 *   /board     public live board for the venue TV
 *   /teacher   teacher schedule (pick your name)
 *   /admin     admin dashboard (password)
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './lib/i18n';
import { LiveProvider } from './lib/live';
import { BookPage } from './pages/BookPage';
import { MySchedulePage } from './pages/MySchedulePage';

const BoardPage = lazy(() => import('./pages/BoardPage'));
const TeacherPage = lazy(() => import('./pages/TeacherPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <LiveProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<BookPage />} />
                <Route path="/my" element={<MySchedulePage />} />
                <Route path="/board" element={<BoardPage />} />
                <Route path="/teacher" element={<TeacherPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<BookPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </LiveProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
