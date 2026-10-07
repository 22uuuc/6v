// EXPORTS: Layout（组件文件）
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import SiteHeader from '@/components/SiteHeader';
import BottomNav from '@/components/BottomNav';
import GuardBanner from '@/components/GuardBanner';

/** 全站动漫氛围：飘落光点（固定参数，纯装饰） */
const FALLING_DOTS = [
  { left: '8%', delay: '0s', duration: '13s', size: 4 },
  { left: '22%', delay: '3.5s', duration: '17s', size: 3 },
  { left: '38%', delay: '7s', duration: '15s', size: 5 },
  { left: '55%', delay: '2s', duration: '19s', size: 3 },
  { left: '70%', delay: '9s', duration: '14s', size: 4 },
  { left: '83%', delay: '5s', duration: '18s', size: 3 },
  { left: '92%', delay: '11s', duration: '16s', size: 5 },
  { left: '15%', delay: '13s', duration: '20s', size: 3 },
];

export const Layout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="anime-atmosphere" aria-hidden="true">
        {FALLING_DOTS.map((d, i) => (
          <span
            key={i}
            className="falling-dot"
            style={{ left: d.left, width: d.size, height: d.size, animationDelay: d.delay, animationDuration: d.duration }}
          />
        ))}
      </div>
      <GuardBanner />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:pb-10">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
};
