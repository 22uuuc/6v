// EXPORTS: AdminPage（组件文件）
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookCheck, Landmark, ShieldCheck, Settings2, Banknote, Lock, KeyRound, UserCheck, Headset, Cloud, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDataVersion } from '@/hooks/use-data';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">管理后台</h1>
          <p className="mt-1 text-sm text-muted-foreground">代码锁已开启 · 数据签名防篡改 · 内容安全中心</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { sessionStorage.removeItem(UNLOCK_KEY); setUnlocked(false); }}>
          <Lock className="mr-1 h-3.5 w-3.5" /> 锁定后台
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start gap-1.5 p-2 sm:w-auto">
          <TabsTrigger value="overview" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <LayoutDashboard className="h-4 w-4" /> 概览
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Users className="h-4 w-4" /> 用户与等级
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <UserCheck className="h-4 w-4" /> 资质审核
          </TabsTrigger>
          <TabsTrigger value="books" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <BookCheck className="h-4 w-4" /> 作品审核
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Banknote className="h-4 w-4" /> 收益结算
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Landmark className="h-4 w-4" /> 提现审核
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Wallet className="h-4 w-4" /> 支付对接
          </TabsTrigger>
          <TabsTrigger value="service" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Headset className="h-4 w-4" /> 用户服务
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <ShieldCheck className="h-4 w-4" /> 安全中心
          </TabsTrigger>
          <TabsTrigger value="cloud" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Cloud className="h-4 w-4" /> 云同步
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px]">
            <Settings2 className="h-4 w-4" /> 全站设置
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-6">
          <AdminOverview />
        </TabsContent>
        <TabsContent value="users" className="pt-6">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="applications" className="pt-6">
          <AdminApplications />
        </TabsContent>
        <TabsContent value="books" className="pt-6">
          <AdminBooks />
        </TabsContent>
        <TabsContent value="settlements" className="pt-6">
          <AdminSettlements />
        </TabsContent>
        <TabsContent value="withdrawals" className="pt-6">
          <AdminWithdrawals />
        </TabsContent>
        <TabsContent value="payments" className="pt-6">
          <AdminPayments />
        </TabsContent>
        <TabsContent value="service" className="pt-6">
          <AdminService />
        </TabsContent>
        <TabsContent value="security" className="pt-6">
          <AdminSecurity />
        </TabsContent>
        <TabsContent value="cloud" className="pt-6">
          <AdminCloudSync />
        </TabsContent>
        <TabsContent value="settings" className="pt-6">
          <AdminSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
