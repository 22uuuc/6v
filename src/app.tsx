import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import AuthProvider from '@/components/AuthProvider';
import HomePage from '@/pages/HomePage/HomePage';
import CategoryPage from '@/pages/CategoryPage/CategoryPage';
import BookDetailPage from '@/pages/BookDetailPage/BookDetailPage';
import ReaderPage from '@/pages/ReaderPage/ReaderPage';
import VisualPage from '@/pages/VisualPage/VisualPage';
import ComicPage from '@/pages/ComicPage/ComicPage';
import AnimePage from '@/pages/AnimePage/AnimePage';
import ShelfPage from '@/pages/ShelfPage/ShelfPage';
import SearchPage from '@/pages/SearchPage/SearchPage';
import AuthPage from '@/pages/AuthPage/AuthPage';
import ProfilePage from '@/pages/ProfilePage/ProfilePage';
import CreatorPage from '@/pages/CreatorPage/CreatorPage';
import UploadNovelPage from '@/pages/UploadNovelPage/UploadNovelPage';
import UploadVisualPage from '@/pages/UploadVisualPage/UploadVisualPage';
import UploadComicPage from '@/pages/UploadComicPage/UploadComicPage';
import UploadAnimePage from '@/pages/UploadAnimePage/UploadAnimePage';
import EarningsPage from '@/pages/EarningsPage/EarningsPage';
import FeedbackPage from '@/pages/FeedbackPage/FeedbackPage';
import SupportPage from '@/pages/SupportPage/SupportPage';
import RankPage from '@/pages/RankPage/RankPage';
import AdminPage from '@/pages/AdminPage/AdminPage';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="category/:type" element={<CategoryPage />} />
          <Route path="book/:id" element={<BookDetailPage />} />
          <Route path="read/:bookId/:chapterId" element={<ReaderPage />} />
          <Route path="visual/:bookId" element={<VisualPage />} />
          <Route path="comic/:bookId/:chapterId" element={<ComicPage />} />
          <Route path="anime/:bookId" element={<AnimePage />} />
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
          <Route path="creator/earnings" element={<EarningsPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
