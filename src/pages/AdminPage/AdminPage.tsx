// EXPORTS: AdminPage（组件文件）
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookCheck, Landmark, ShieldCheck, Settings2, Banknote, Lock, KeyRound, UserCheck, Headset, Cloud, Wallet, Menu, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDataVersion } from '@/hooks/use-data';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import AdminOverview from '@/pages/AdminPage/AdminOverview';
import AdminUsers from '@/pages/AdminPage/AdminUsers';
import AdminBooks from '@/pages/AdminPage/AdminBooks';
import AdminWithdrawals from '@/pages/AdminPage/AdminWithdrawals';
import AdminSecurity from '@/pages/AdminPage/AdminSecurity';
import AdminSettlements from '@/pages/AdminPage/AdminSettlements';
import AdminSettings from '@/pages/AdminPage/AdminSettings';
import AdminCloudSync from '@/pages/AdminPage/AdminCloudSync';
import AdminApplications from '@/pages/AdminPage/AdminApplications';
import AdminService from '@/pages/AdminPage/AdminService';
import AdminPayments from '@/pages/AdminPage/AdminPayments';

const UNLOCK_KEY = 'moying-admin-unlocked';

/** 后台功能清单（抽屉 / 桌面侧栏共用） */
const ADMIN_TABS = [
  { value: 'overview', label: '概览', icon: LayoutDashboard },
  { value: 'users', label: '用户与等级', icon: Users },
  { value: 'applications', label: '资质审核', icon: UserCheck },
  { value: 'books', label: '作品审核', icon: BookCheck },
  { value: 'settlements', label: '收益结算', icon: Banknote },
  { value: 'withdrawals', label: '提现审核', icon: Landmark },
  { value: 'payments', label: '支付对接', icon: Wallet },
  { value: 'service', label: '用户服务', icon: Headset },
  { value: 'security', label: '安全中心', icon: ShieldCheck },
  { value: 'cloud', label: '云同步', icon: Cloud },
  { value: 'settings', label: '全站设置', icon: Settings2 },
];

const TAB_CONTENT: Record<string, ReactNode> = {
  overview: <AdminOverview />,
  users: <AdminUsers />,
  applications: <AdminApplications />,
  books: <AdminBooks />,
  settlements: <AdminSettlements />,
  withdrawals: <AdminWithdrawals />,
  payments: <AdminPayments />,
  service: <AdminService />,
  security: <AdminSecurity />,
  cloud: <AdminCloudSync />,
  settings: <AdminSettings />,
};

/** 管理后台代码锁：未设置安全码先设置，已设置需验证通过才能进入 */
function AdminGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { user } = useAuth();
  const settings = api.getSettings();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [lockedRemain, setLockedRemain] = useState(() => (api.adminLockedUntil() ? Math.max(0, Math.ceil((api.adminLockedUntil() - Date.now()) / 1000)) : 0));

  useEffect(() => {
    if (!lockedRemain) return;
    const t = setInterval(() => {
      const remain = Math.max(0, Math.ceil((api.adminLockedUntil() - Date.now()) / 1000));
      setLockedRemain(remain);
      if (remain === 0) setMsg('');
    }, 1000);
    return () => clearInterval(t);
  }, [lockedRemain]);

  if (!user) return null;

  const submit = () => {
    if (!settings.adminCode) {
      if (code.length < 4) {
        setMsg('安全码至少 4 位');
        return;
      }
      api.ensureAdminCode(code, user.id);
      sessionStorage.setItem(UNLOCK_KEY, '1');
      toast.success('安全码已启用');
      onUnlocked();
      return;
    }
    const res = api.verifyAdminCode(code);
    if (!res.ok) {
      setMsg(res.msg ?? '安全码错误');
      if (res.lockedUntil) setLockedRemain(Math.max(0, Math.ceil((res.lockedUntil - Date.now()) / 1000)));
      return;
    }
    sessionStorage.setItem(UNLOCK_KEY, '1');
    onUnlocked();
  };

  return (
    <div className="mx-auto max-w-sm space-y-5 py-16">
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Lock className="h-6 w-6" />
            </span>
            <h1 className="font-serif text-lg font-bold">{settings.adminCode ? '管理后台代码锁' : '首次启用安全码'}</h1>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {settings.adminCode
                ? '输入管理员安全码解锁后台。连续输错 5 次将锁定 10 分钟并触发入侵警告。'
                : '为管理后台设置安全码（≥4 位），之后每次进入后台都需验证。此锁可防止他人破解/越权操作。'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{settings.adminCode ? '安全码' : '新安全码'}</Label>
            <Input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={settings.adminCode ? '输入安全码' : '设置 4 位以上安全码'}
              autoFocus
            />
          </div>
          {msg && <p className="mt-2 text-xs text-destructive">{msg}</p>}
          {lockedRemain > 0 && (
            <p className="mt-2 text-xs text-destructive">后台已锁定，剩余 {lockedRemain} 秒后重试</p>
          )}
          <Button className="mt-4 w-full gap-1.5" onClick={submit} disabled={lockedRemain > 0}>
            <KeyRound className="h-4 w-4" /> {settings.adminCode ? '解锁后台' : '启用安全码'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDataVersion();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1');
  const [tab, setTab] = useState('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchX = useRef<number | null>(null);

  if (!user || user.role !== 'admin') {
    return (
      <div className="py-20">
        <EmptyState text="管理后台仅限管理员访问" />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate('/')}>返回首页</Button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return <AdminGate onUnlocked={() => setUnlocked(true)} />;
  }

  const go = (v: string) => {
    setTab(v);
    setDrawerOpen(false);
  };

  /** 内容区左右滑动切换功能页（手机 App 手势） */
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 70) return;
    const idx = ADMIN_TABS.findIndex((t) => t.value === tab);
    const next = dx < 0 ? Math.min(idx + 1, ADMIN_TABS.length - 1) : Math.max(idx - 1, 0);
    if (next !== idx) setTab(ADMIN_TABS[next].value);
  };

  return (
    <div className="space-y-5">
      {/* 顶部栏：移动端汉堡入口 + 标题 + 锁定 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Button size="icon" variant="outline" className="md:hidden" onClick={() => setDrawerOpen(true)} aria-label="打开后台菜单">
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold">管理后台</h1>
            <p className="mt-1 text-sm text-muted-foreground">代码锁已开启 · 数据签名防篡改 · 内容安全中心</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { sessionStorage.removeItem(UNLOCK_KEY); setUnlocked(false); }}>
          <Lock className="mr-1 h-3.5 w-3.5" /> 锁定后台
        </Button>
      </div>

      {/* 移动端抽屉遮罩 */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)} />}

      {/* 移动端抽屉导航（左侧滑出，匹配手机 App） */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background shadow-2xl transition-transform duration-300 md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
          <div>
            <p className="font-serif text-base font-bold">墨影书城 · 管理后台</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">后台功能</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setDrawerOpen(false)} aria-label="关闭菜单">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {ADMIN_TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => go(t.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors',
                  active ? 'bg-primary/12 font-medium text-primary' : 'text-foreground/80 hover:bg-muted/70',
                )}
              >
                <t.icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                <span className="flex-1 text-left">{t.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 桌面侧边栏（宽屏） */}
      <div className="flex gap-5">
        <aside className="hidden w-52 shrink-0 flex-col gap-1 md:flex">
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">后台功能</p>
          {ADMIN_TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => go(t.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors',
                  active ? 'bg-primary/12 font-medium text-primary' : 'text-foreground/80 hover:bg-muted/70',
                )}
              >
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </aside>

        {/* 内容区：支持左右滑动切换 */}
        <div className="min-w-0 flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <Tabs value={tab} onValueChange={setTab}>
            {ADMIN_TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="pt-1">
                {TAB_CONTENT[t.value]}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
