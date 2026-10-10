import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Layout } from '@/components/Layout';
import AuthProvider from '@/components/AuthProvider';
import { ErrorFallback } from '@/components/ErrorFallback';
import MoyingMascot from '@/components/MoyingMascot';
import HomePage from '@/pages/HomePage/HomePage';

// 路由懒加载（代码分割，按需加载）
const CategoryPage = lazy(() => import('@/pages/CategoryPage/CategoryPage'));
const BookDetailPage = lazy(() => import('@/pages/BookDetailPage/BookDetailPage'));
const ReaderPage = lazy(() => import('@/pages/ReaderPage/ReaderPage'));
const VisualPage = lazy(() => import('@/pages/VisualPage/VisualPage'));
const ComicPage = lazy(() => import('@/pages/ComicPage/ComicPage'));
const AnimePage = lazy(() => import('@/pages/AnimePage/AnimePage'));
const DialoguePage = lazy(() => import('@/pages/DialoguePage/DialoguePage'));
const GamePage = lazy(() => import('@/pages/GamePage/GamePage'));
const UploadDialoguePage = lazy(() => import('@/pages/UploadDialoguePage/UploadDialoguePage'));
const UploadGamePage = lazy(() => import('@/pages/UploadGamePage/UploadGamePage'));
const ShelfPage = lazy(() => import('@/pages/ShelfPage/ShelfPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage/SearchPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage/AuthPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage/ProfilePage'));
const CreatorPage = lazy(() => import('@/pages/CreatorPage/CreatorPage'));
const UploadNovelPage = lazy(() => import('@/pages/UploadNovelPage/UploadNovelPage'));
const UploadVisualPage = lazy(() => import('@/pages/UploadVisualPage/UploadVisualPage'));
const UploadComicPage = lazy(() => import('@/pages/UploadComicPage/UploadComicPage'));
const UploadAnimePage = lazy(() => import('@/pages/UploadAnimePage/UploadAnimePage'));
const EarningsPage = lazy(() => import('@/pages/EarningsPage/EarningsPage'));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage/FeedbackPage'));
const SupportPage = lazy(() => import('@/pages/SupportPage/SupportPage'));
const RankPage = lazy(() => import('@/pages/RankPage/RankPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage/AdminPage'));
const ActivitiesPage = lazy(() => import('@/pages/ActivitiesPage/ActivitiesPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage/NotFoundPage'));

/** 路由加载中占位符（书灵翻页 · IP 触点） */
function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="mascot-bounce drop-shadow-[0_0_16px_rgba(168,130,255,0.4)]">
          <MoyingMascot mood="reading" size={72} art />
        </div>
        <p className="text-sm text-muted-foreground">书灵正在翻页…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="category/:type" element={<CategoryPage />} />
              <Route path="book/:id" element={<BookDetailPage />} />
              <Route path="read/:bookId/:chapterId" element={<ReaderPage />} />
              <Route path="visual/:bookId" element={<VisualPage />} />
              <Route path="comic/:bookId/:chapterId" element={<ComicPage />} />
              <Route path="anime/:bookId" element={<AnimePage />} />
              <Route path="dialogue/:bookId/:chapterId" element={<DialoguePage />} />
              <Route path="game/:bookId" element={<GamePage />} />
              <Route path="shelf" element={<ShelfPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="rank" element={<RankPage />} />
              <Route path="auth" element={<AuthPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="creator" element={<CreatorPage />} />
              <Route path="creator/upload-novel" element={<UploadNovelPage />} />
              <Route path="creator/upload-visual" element={<UploadVisualPage />} />
              <Route path="creator/upload-comic" element={<UploadComicPage />} />
              <Route path="creator/upload-anime" element={<UploadAnimePage />} />
              <Route path="creator/upload-dialogue" element={<UploadDialoguePage />} />
              <Route path="creator/upload-game" element={<UploadGamePage />} />
              <Route path="creator/earnings" element={<EarningsPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="activities" element={<ActivitiesPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
