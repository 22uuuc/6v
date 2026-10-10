import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';
import MoyingMascot from '@/components/MoyingMascot';
import { Button } from '@/components/ui/button';

/** 迷路星尘：缓慢漂浮的氛围光点 */
const LOST_STARS = [
  { left: '14%', top: '22%', size: 3, delay: '0s' },
  { left: '82%', top: '30%', size: 4, delay: '1.4s' },
  { left: '28%', top: '64%', size: 2, delay: '2.8s' },
  { left: '68%', top: '70%', size: 3, delay: '0.7s' },
  { left: '48%', top: '14%', size: 2, delay: '3.5s' },
];

export default function NotFoundPage() {
  return (
    <div className="anim-fade-up relative flex flex-col items-center justify-center overflow-hidden py-20 text-center md:py-24">
      {/* 星尘氛围 */}
      {LOST_STARS.map((p, i) => (
        <span
          key={i}
          className="star-drift"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }}
        />
      ))}
      {/* 弥雾光斑 */}
      <span className="drift-slow absolute left-[12%] top-[40%] h-16 w-16 rounded-full bg-primary/10 blur-lg" />
      <span className="drift-slower absolute right-[14%] top-[56%] h-10 w-10 rounded-full bg-accent/15 blur-md" />

      {/* 迷路打盹的书灵 */}
      <div className="mascot-float relative drop-shadow-[0_0_20px_rgba(168,130,255,0.45)]">
        <MoyingMascot mood="sleepy" size={120} art />
      </div>

      <h1 className="text-gradient-anime mt-5 font-serif text-6xl font-bold tracking-widest md:text-7xl">404</h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        这一页去书里迷路了，书灵在原地打盹等你把它领回家
      </p>

      <div className="mt-7 flex gap-2">
        <Button asChild size="sm" className="btn-anime gap-1.5">
          <Link to="/">
            <Home className="h-3.5 w-3.5" /> 返回首页
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/category/all">
            <Compass className="h-3.5 w-3.5" /> 去逛书城
          </Link>
        </Button>
      </div>
    </div>
  );
}
