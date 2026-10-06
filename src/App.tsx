/**
 * Routes:
 *   /          greeting + choose level (share this link / QR code)
 *   /sd        parent booking flow, Primary School (class → time)
 *   /smp-sma   parent booking flow, Junior–Senior High (teacher → time)
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
import { HomePage } from './pages/HomePage';
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
                <Route path="/" element={<HomePage />} />
                <Route path="/sd" element={<BookPage key="sd" level="sd" />} />
                <Route path="/smp-sma" element={<BookPage key="smp_sma" level="smp_sma" />} />
                <Route path="/my" element={<MySchedulePage />} />
                <Route path="/board" element={<BoardPage />} />
                <Route path="/teacher" element={<TeacherPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </LiveProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
