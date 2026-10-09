// EXPORTS: SiteHeader（组件文件）
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BookOpenText, Search, UserRound, LogOut, PenLine, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, isVip } from '@/lib/api';
import { avatarSVG } from '@/lib/svg';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { path: '/', label: '首页', end: true },
  { path: '/category/all', label: '书城', end: false },
  { path: '/shelf', label: '书架', end: false },
];

export default function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(12_92%_60%)] to-[hsl(9_88%_50%)] text-white shadow-[0_0_14px_-2px_hsl(12_92%_56%/0.5)]">
            <BookOpenText className="h-4.5 w-4.5" />
          </span>
          <span className="hidden font-serif text-lg font-bold tracking-wide sm:block">墨影书城</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `nav-pill rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'is-active bg-primary/10 font-medium text-primary shadow-[0_0_12px_-4px_hsl(275_84%_64%/0.6)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {(user?.role === 'creator' || user?.role === 'admin') && (
            <NavLink
              to="/creator"
              className={({ isActive }) =>
                `nav-pill rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'is-active bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              创作者中心
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `nav-pill rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'is-active bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              管理后台
            </NavLink>
          )}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/search')} aria-label="搜索">
            <Search className="h-4.5 w-4.5" />
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-border transition-shadow hover:ring-primary"
                  aria-label="个人菜单"
                >
                  <div dangerouslySetInnerHTML={{ __html: avatarSVG(user.id, user.nickname) }} />
                  {isVip(user) && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <span className="truncate">{user.nickname}</span>
                  {isVip(user) && (
                    <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      VIP
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserRound className="mr-2 h-4 w-4" />
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/creator')}>
                  <PenLine className="mr-2 h-4 w-4" />
                  创作者中心
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/creator/earnings')}>
                  <Wallet className="mr-2 h-4 w-4" />
                  收益中心
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    管理后台
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    api.logout();
                    navigate('/');
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => navigate('/auth')}>
              登录 / 注册
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
