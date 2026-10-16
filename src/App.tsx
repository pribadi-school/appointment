/**
 * Routes:
 *   /          greeting + choose level (share this link / QR code)
 *   /sd        parent booking flow, Primary School (class → time)
 *   /smp-sma   parent booking flow, Junior–Senior High (teacher → time)
 *   /my        parent's own schedule
 *   /board     public live board for the venue TV
 *   /now       live dashboard (admin): choose level; /now/sd, /now/smp-sma show
 *              the consultations in progress with room + booking code
 *   /livedummy public preview of that screen with sample data (/livedummy/sd)
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
const NowPage = lazy(() => import('./pages/NowPage'));
const NowDummyPage = lazy(() => import('./pages/NowPage').then((m) => ({ default: m.NowDummyPage })));

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
                <Route path="/now" element={<NowPage />} />
                <Route path="/now/sd" element={<NowPage level="sd" />} />
                <Route path="/now/smp-sma" element={<NowPage level="smp_sma" />} />
                <Route path="/livedummy" element={<NowDummyPage level="smp_sma" />} />
                <Route path="/livedummy/sd" element={<NowDummyPage level="sd" />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </LiveProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
