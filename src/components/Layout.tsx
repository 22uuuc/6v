// EXPORTS: Layout（组件文件）
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import SiteHeader from '@/components/SiteHeader';
import BottomNav from '@/components/BottomNav';
import GuardBanner from '@/components/GuardBanner';
import PlatformStyle from '@/components/PlatformStyle';
import { api } from '@/lib/api';
import { PLATFORM_STYLES, type AtmosphereType } from '@/lib/platform-style';
import { useDataVersion } from '@/hooks/use-data';

/** 星夜光点（默认动漫氛围）：金色小圆点从顶部落下 */
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

/** 国风朱砂花瓣：椭圆花瓣飘落（红/金） */
const PETALS = [
  { left: '10%', delay: '0s', duration: '16s', size: 7, extra: 5 },
  { left: '26%', delay: '4s', duration: '19s', size: 6, extra: 3 },
  { left: '41%', delay: '8s', duration: '17s', size: 8, extra: 4 },
  { left: '58%', delay: '2s', duration: '21s', size: 6, extra: 6 },
  { left: '73%', delay: '10s', duration: '18s', size: 7, extra: 5 },
  { left: '88%', delay: '6s', duration: '20s', size: 5, extra: 4 },
];

/** 清新漫感叶子：绿/粉小叶子飘落 */
const LEAVES = [
  { left: '9%', delay: '1s', duration: '15s', size: 6, extra: 8 },
  { left: '24%', delay: '5s', duration: '18s', size: 5, extra: 6 },
  { left: '39%', delay: '9s', duration: '16s', size: 7, extra: 7 },
  { left: '56%', delay: '3s', duration: '20s', size: 5, extra: 9 },
  { left: '72%', delay: '11s', duration: '17s', size: 6, extra: 7 },
  { left: '86%', delay: '7s', duration: '19s', size: 4, extra: 8 },
];

/** 氛围粒子配置：形状由 CSS 类控制（atmo-aurora / atmo-guofeng / atmo-kawaii） */
interface Particle {
  left: string;
  delay: string;
  duration: string;
  size: number;
  extra?: number;
}
const ATMOSPHERE_PARTICLES: Record<AtmosphereType, { list: Particle[]; className: string }> = {
  aurora: { list: FALLING_DOTS, className: 'falling-dot' },
  guofeng: { list: PETALS, className: 'falling-petal' },
  kawaii: { list: LEAVES, className: 'falling-leaf' },
};

export const Layout = () => {
  useDataVersion();
  const s = api.getSettings();
  const st = PLATFORM_STYLES[s.layoutStyle ?? 'anime'] ?? PLATFORM_STYLES.anime;
  const atmo = st.atmosphere;
  const particles = ATMOSPHERE_PARTICLES[atmo];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PlatformStyle />
      <div className={`anime-atmosphere atmo-${atmo}`} aria-hidden="true">
        {/* 云朵装饰（国风祥云 / 清新漫感云朵） */}
        {atmo !== 'aurora' && (
          <>
            <span className="atmo-cloud cloud-1" />
            <span className="atmo-cloud cloud-2" />
            <span className="atmo-cloud cloud-3" />
          </>
        )}
        {particles.list.map((d, i) => (
          <span
            key={i}
            className={particles.className}
            style={{
              left: d.left,
              width: d.size,
              height: 'auto',
              aspectRatio: 'auto',
              animationDelay: d.delay,
              animationDuration: d.duration,
              ['--petal-h' as string]: `${d.extra}px`,
            }}
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
