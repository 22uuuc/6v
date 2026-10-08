// EXPORTS: BottomNav（组件文件）
import { NavLink } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, LibraryIcon, BookMarkedIcon, UserCircleIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

const ITEMS = [
  { path: '/', label: '首页', icon: Home01Icon, end: true },
  { path: '/category/all', label: '书城', icon: LibraryIcon, end: false },
  { path: '/shelf', label: '书架', icon: BookMarkedIcon, end: false },
  { path: '/profile', label: '我的', icon: UserCircleIcon, end: false },
];

export default function BottomNav() {
  return (
    <nav className="glass-nav fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'nav-pill relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
                isActive ? 'is-active text-primary' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300',
                    isActive
                      ? 'bg-primary/15 shadow-[0_0_14px_-2px_hsl(275_84%_64%/0.6)]'
                      : 'bg-transparent',
                  )}
                >
                  <HugeiconsIcon icon={item.icon} className={cn('h-5 w-5 transition-transform duration-300', isActive && 'scale-110')} />
                </span>
                <span className={cn(isActive && 'font-medium')}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
