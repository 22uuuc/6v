import { useState, useEffect } from 'react';
import {
  Cloud,
  Download,
  Upload,
  KeyRound,
  Database,
  ShieldCheck,
  GitBranch,
  ExternalLink,
  Lock,
  Palette,
  RefreshCw,
  Zap,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Check,
  X,
  Key,
  ChevronDown,
  ChevronUp,
  Users,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import {
  cloud,
  onAutoSyncChange,
  setAutoSyncEnabled,
  triggerAutoSyncNow,
  CLOUD_CHANNEL,
  CLOUD_FILES,
  USER_DATA_FILES,
  SETTINGS_FILES,
} from '@/lib/cloud';
import { useDataVersion } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// 云端传送渠道：固定连接写死于代码（src/lib/cloud.ts 的 CLOUD_CHANNEL），本地不支持修改，变更渠道只能修改代码并经 GitHub 仓库发布
const repo = CLOUD_CHANNEL.content;
const userRepo = CLOUD_CHANNEL.user;
const settingsRepo = CLOUD_CHANNEL.settings;

interface AutoSyncState {
  enabled: boolean;
  status: 'idle' | 'pending' | 'syncing' | 'error';
  pendingCount: number;
  lastError?: string;
}

interface TokenPermissionResult {
  repo: string;
  label: string;
  tokenConfigured: boolean;
  tokenValid: boolean;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
}

export default function AdminCloudSync() {
  useDataVersion();
  const { user } = useAuth();

  // 内容库令牌/口令输入
  const [tokenInput, setTokenInput] = useState('');
  const [passInput, setPassInput] = useState('');
  // 用户数据仓令牌/口令输入
  const [uTokenInput, setUTokenInput] = useState('');
  const [uPassInput, setUPassInput] = useState('');

  // 令牌/口令保存状态（异步加载）
  const [tokenSaved, setTokenSaved] = useState(false);
  const [passSaved, setPassSaved] = useState(false);
  const [uTokenSaved, setUTokenSaved] = useState(false);
  const [uPassSaved, setUPassSaved] = useState(false);
  const [sTokenSaved, setSTokenSaved] = useState(false);
  // 统一令牌
  const [unifiedTokenSaved, setUnifiedTokenSaved] = useState(false);
  const [unifiedTokenInput, setUnifiedTokenInput] = useState('');
  const [unifiedTokenBusy, setUnifiedTokenBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 同步状态
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [uPulling, setUPulling] = useState(false);
  const [uPushing, setUPushing] = useState(false);
  const [sPulling, setSPulling] = useState(false);
  const [sPushing, setSPushing] = useState(false);

  // 自动同步状态
  const [autoSync, setAutoSync] = useState<AutoSyncState>({
    enabled: false,
    status: 'idle',
    pendingCount: 0,
  });

  // 令牌权限检测
  const [permChecking, setPermChecking] = useState(false);
  const [permResult, setPermResult] = useState<{
    contentRepo: TokenPermissionResult;
    userRepo: TokenPermissionResult;
    settingsRepo: TokenPermissionResult;
  } | null>(null);

  // 一键改口令
  const [newPassInput, setNewPassInput] = useState('');
  const [rotateBusy, setRotateBusy] = useState(false);
  // 真人解锁通道：后端投递链路自检（统一令牌就绪状态 + 真实发码测试）
  const [unlockTokenOk, setUnlockTokenOk] = useState<boolean | null>(null);
  const [unlockTesting, setUnlockTesting] = useState(false);
  const [unlockTestMsg, setUnlockTestMsg] = useState('');

  useEffect(() => {
    let live = true;
    cloud.hasUnlockToken().then((v) => { if (live) setUnlockTokenOk(v); });
    return () => { live = false; };
  }, []);

  /** 通道自检：真实走一遍「请求 → repository_dispatch → 工作流 → QQ 邮箱」，结果直接反馈给真人管理员 */
  const runUnlockSelfTest = async () => {
    setUnlockTesting(true);
    setUnlockTestMsg('');
    try {
      const r = await cloud.requestUnlockCode();
      setUnlockTestMsg(r.msg ?? (r.ok ? '验证码已投递' : '投递失败'));
      if (r.ok) toast.success(r.msg ?? '验证码已投递，请查收邮箱');
      else toast.error(r.msg ?? '投递失败');
    } catch {
      setUnlockTestMsg('通道异常，请检查网络');
      toast.error('通道异常，请检查网络');
    } finally {
      setUnlockTesting(false);
    }
  };

  // 同步元信息
  const [lastPullAt, setLastPullAt] = useState<string>('');
  const [lastPushAt, setLastPushAt] = useState<string>('');


  useEffect(() => {
    let mounted = true;
    (async () => {
      const [ts, ps, uts, ups, sts, unif] = await Promise.all([
        cloud.tokenSaved(),
        cloud.passSaved(),
        cloud.userTokenSaved(),
        cloud.userPassSaved(),
        cloud.settingsTokenSaved(),
        cloud.unifiedTokenSaved(),
      ]);
      if (mounted) {
        setTokenSaved(ts);
        setPassSaved(ps);
        setUTokenSaved(uts);
        setUPassSaved(ups);
        setSTokenSaved(sts);
        setUnifiedTokenSaved(unif);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const off = onAutoSyncChange((s) => setAutoSync(s));
    return off;
  }, []);

  const handleSaveToken = async () => {
    if (!(await cloud.saveToken(tokenInput))) {
      toast.error('保存被拒绝：仅管理员可配置（请确认已用管理员账号登录）');
      return;
    }
    setTokenInput('');
    toast.success('令牌已保存到本机浏览器');
    setTokenSaved(true);
  };

  const handleSaveUnifiedToken = async () => {
    if (!unifiedTokenInput.trim()) {
      toast.error('请输入令牌');
      return;
    }
    setUnifiedTokenBusy(true);
    try {
      if (!(await cloud.saveUnifiedToken(unifiedTokenInput.trim()))) {
        toast.error('保存被拒绝：仅管理员可配置统一令牌（请确认已用管理员账号登录）');
        return;
      }
      setUnifiedTokenSaved(true);
      setUnifiedTokenInput('');
      toast.success('统一令牌已保存，一个钥匙通三仓 ✅');
      cloud.hasUnlockToken().then((v) => setUnlockTokenOk(v)); // 即时刷新真人解锁通道徽章
      const [ts, uts, sts] = await Promise.all([
        cloud.tokenSaved(),
        cloud.userTokenSaved(),
        cloud.settingsTokenSaved(),
      ]);
      setTokenSaved(ts);
      setUTokenSaved(uts);
      setSTokenSaved(sts);
    } catch (e) {
      toast.error(`保存失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setUnifiedTokenBusy(false);
    }
  };

  const handleClearUnifiedToken = async () => {
    if (!(await cloud.clearUnifiedToken())) {
      toast.error('清除被拒绝：仅管理员可操作');
      return;
    }
    setUnifiedTokenSaved(false);
    toast.info('统一令牌已清除');
    cloud.hasUnlockToken().then((v) => setUnlockTokenOk(v));
    const [ts, uts, sts] = await Promise.all([
      cloud.tokenSaved(),
      cloud.userTokenSaved(),
      cloud.settingsTokenSaved(),
    ]);
    setTokenSaved(ts);
    setUTokenSaved(uts);
    setSTokenSaved(sts);
  };

  const handleSavePass = async () => {
    if (passInput.trim().length < 6) {
      toast.error('加密口令至少 6 位');
      return;
    }
    if (!(await cloud.savePass(passInput.trim()))) {
      toast.error('保存被拒绝：仅管理员可配置（请确认已用管理员账号登录）');
      return;
    }
    setPassSaved(true);
    setPassInput('');
    toast.success('加密口令已保存（推送将加密落库，明文数据拒收）');
  };

  const handleClearToken = async () => {
    if (!(await cloud.clearToken())) {
      toast.error('清除被拒绝：仅管理员可操作');
      return;
    }
    setTokenSaved(false);
    toast.info('令牌已清除');
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const r = await cloud.pullFromCloud();
      if (r.ok) {
        toast.success(r.msg ?? '拉取成功');
        setLastPullAt(cloud.meta().lastPullAt ?? '');
      } else {
        toast.error(r.msg ?? '拉取失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '拉取异常');
    } finally {
      setPulling(false);
    }
  };

  const handlePush = async () => {
    if (!passSaved && !(await cloud.passSaved())) {
      toast.error('请先设置加密口令，防止明文入库');
      return;
    }
    setPushing(true);
    try {
      const r = await cloud.pushToCloud();
      if (r.ok) {
        toast.success(r.msg ?? '推送成功');
        setLastPushAt(cloud.meta().lastPushAt ?? '');
      } else if (r.conflicts && r.conflicts.length > 0) {
        toast.error(`冲突：${r.conflicts.join(', ')} — 请先拉取最新内容`);
      } else {
        toast.error(r.msg ?? '推送失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '推送异常');
    } finally {
      setPushing(false);
    }
  };

  /* ======== 用户数据仓 ======== */
  const handleSaveUserToken = async () => {
    if (!(await cloud.saveUserToken(uTokenInput))) {
      toast.error('保存被拒绝：仅管理员可配置（请确认已用管理员账号登录）');
      return;
    }
    setUTokenInput('');
    toast.success('用户数据仓库令牌已保存');
    setUTokenSaved(true);
  };

  const handleClearUserToken = async () => {
    if (!(await cloud.clearUserToken())) {
      toast.error('清除被拒绝：仅管理员可操作');
      return;
    }
    setUTokenSaved(false);
    toast.info('用户数据仓库令牌已清除');
  };

  const handleSaveUserPass = async () => {
    if (uPassInput.trim().length < 6) {
      toast.error('加密口令至少 6 位');
      return;
    }
    if (!(await cloud.saveUserPass(uPassInput.trim()))) {
      toast.error('保存被拒绝：仅管理员可配置（请确认已用管理员账号登录）');
      return;
    }
    setUPassSaved(true);
    setUPassInput('');
    toast.success('用户数据仓库口令已保存');
  };

  const handlePullUser = async () => {
    setUPulling(true);
    try {
      const r = await cloud.pullUserData();
      if (r.ok) {
        toast.success(r.msg ?? '拉取成功');
      } else {
        toast.error(r.msg ?? '拉取失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '拉取异常');
    } finally {
      setUPulling(false);
    }
  };

  const handlePushUser = async () => {
    if (!uPassSaved && !(await cloud.userPassSaved())) {
      toast.error('请先设置用户数据仓库口令');
      return;
    }
    setUPushing(true);
    try {
      const r = await cloud.pushUserData();
      if (r.ok) {
        toast.success(r.msg ?? '推送成功');
      } else if (r.conflicts && r.conflicts.length > 0) {
        toast.error(`冲突：${r.conflicts.join(', ')} — 请先拉取`);
      } else {
        toast.error(r.msg ?? '推送失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '推送异常');
    } finally {
      setUPushing(false);
    }
  };

  /* ======== 设置仓 ======== */
  const handlePullSettings = async () => {
    setSPulling(true);
    try {
      const r = await cloud.pullSettings();
      if (r.ok) {
        toast.success(r.msg ?? '设置拉取成功');
      } else {
        toast.error(r.msg ?? '拉取失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '拉取异常');
    } finally {
      setSPulling(false);
    }
  };

  const handlePushSettings = async () => {
    if (!uPassSaved && !(await cloud.userPassSaved())) {
      toast.error('请先设置用户数据仓库口令（设置仓复用）');
      return;
    }
    setSPushing(true);
    try {
      const r = await cloud.pushSettings();
      if (r.ok) {
        toast.success(r.msg ?? '设置推送成功');
      } else if (r.conflicts && r.conflicts.length > 0) {
        toast.error(`冲突：${r.conflicts.join(', ')} — 请先拉取`);
      } else {
        toast.error(r.msg ?? '推送失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '推送异常');
    } finally {
      setSPushing(false);
    }
  };

  /* ======== 权限检测 ======== */
  const handleCheckPermissions = async () => {
    setPermChecking(true);
    setPermResult(null);
    try {
      const r = await cloud.checkTokenPermissions();
      setPermResult(r);
      const allOk =
        r.contentRepo.canRead && r.contentRepo.canWrite &&
        r.userRepo.canRead && r.userRepo.canWrite &&
        r.settingsRepo.canRead && r.settingsRepo.canWrite;
      if (allOk) {
        toast.success('所有仓库权限检测通过 ✅');
      } else {
        toast.warning('部分仓库权限不足，请查看详情');
      }
    } catch (e) {
      toast.error(`检测失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setPermChecking(false);
    }
  };

  /* ======== 自动同步 ======== */
  const handleToggleAutoSync = async () => {
    if (!autoSync.enabled) {
      const hasToken = tokenSaved || unifiedTokenSaved;
      const hasPass = passSaved;
      if (!hasToken) {
        toast.error('请先配置令牌（统一令牌或内容库独立令牌）');
        return;
      }
      if (!hasPass) {
        toast.error('请先设置加密口令');
        return;
      }
    }
    await setAutoSyncEnabled(!autoSync.enabled);
    toast.success(autoSync.enabled ? '自动同步已关闭' : '自动同步已开启');
  };

  const handleSyncNow = async () => {
    try {
      await triggerAutoSyncNow();
      toast.success('已触发立即同步');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '同步失败');
    }
  };

  /* ======== 一键改口令 ======== */
  const handleRotatePass = async () => {
    if (newPassInput.trim().length < 6) {
      toast.error('新口令至少 6 位');
      return;
    }
    setRotateBusy(true);
    const r = await cloud.rotateAllPasswords(newPassInput.trim());
    setRotateBusy(false);
    if (r.ok) {
      toast.success(r.msg);
      setNewPassInput('');
      setPassSaved(true);
      setUPassSaved(true);
    } else {
      toast.error(r.msg);
      if (r.results) {
        r.results.forEach((x: { repo: string; ok: boolean; msg?: string }) => {
          if (!x.ok) toast.error(`${x.repo}：${x.msg || '失败'}`);
        });
      }
    }
  };

  const autoStatusLabel = () => {
    if (!autoSync.enabled) return '自动同步未开启';
    if (autoSync.status === 'error') return '同步失败';
    if (autoSync.status === 'syncing') return '正在同步到云端…';
    if (autoSync.status === 'pending' && autoSync.pendingCount > 0)
      return `待同步（${autoSync.pendingCount} 项变更）`;
    return '自动同步已开启';
  };

  const autoStatusColor = () => {
    if (!autoSync.enabled) return 'text-muted-foreground';
    if (autoSync.status === 'error') return 'text-destructive';
    if (autoSync.status === 'syncing') return 'text-blue-600';
    if (autoSync.status === 'pending') return 'text-amber-600';
    return 'text-emerald-600';
  };

  const renderPermItem = (r: TokenPermissionResult) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-medium">{r.label}</span>
      <div className="flex items-center gap-2">
        <Badge variant={r.tokenConfigured ? 'outline' : 'secondary'} className={r.tokenConfigured ? 'border-emerald-500/40 text-emerald-600' : ''}>
          {r.tokenConfigured ? <><Check className="mr-0.5 h-3 w-3" /> 已配置</> : '未配置'}
        </Badge>
        <Badge variant={r.tokenValid ? 'outline' : 'destructive'} className={r.tokenValid ? 'border-emerald-500/40 text-emerald-600' : ''}>
          {r.tokenValid ? <><Check className="mr-0.5 h-3 w-3" /> 令牌有效</> : <><X className="mr-0.5 h-3 w-3" /> 无效</>}
        </Badge>
        <Badge variant={r.canRead ? 'outline' : 'destructive'} className={r.canRead ? 'border-emerald-500/40 text-emerald-600' : ''}>
          {r.canRead ? <><Check className="mr-0.5 h-3 w-3" /> 可读</> : <><X className="mr-0.5 h-3 w-3" /> 不可读</>}
        </Badge>
        <Badge variant={r.canWrite ? 'outline' : 'destructive'} className={r.canWrite ? 'border-emerald-500/40 text-emerald-600' : ''}>
          {r.canWrite ? <><Check className="mr-0.5 h-3 w-3" /> 可写</> : <><X className="mr-0.5 h-3 w-3" /> 不可写</>}
        </Badge>
      </div>
    </div>
  );

  return (<div className="page-enter space-y-6">
      {/* 通道区分：管理员后台接入总数据仓库的操作 与 普通用户使用严格分离 */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              管理员操作通道（本页）
              {user && <Badge variant="outline" className="ml-auto border-primary/40 text-[10px] text-primary">{user.nickname}</Badge>}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              经邮箱验证码解锁后台后，方可接入总数据仓库：配置令牌/加密口令、推送三仓、更换口令、权限检测。所有写入操作走本通道并留操作审计，越权调用会被出口权限校验拦截。
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
              <Users className="h-4 w-4" />
              用户使用通道（全站前台）
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              打开网站即自动增量拉取固定渠道（匿名只读提取，无需令牌与登录），无任何写入出口；即使伪造请求调用推送接口也会被拒绝并记入安全审计。用户数据全部在本机浏览器。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 真人解锁通道：后端真实投递验证码，真人收码后解锁并完全操控管理后台 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            真人解锁通道 · 后端连接状态
            <Badge variant="outline" className={unlockTokenOk ? 'ml-auto border-emerald-500/40 text-emerald-600' : 'ml-auto border-destructive/40 text-destructive'}>
              {unlockTokenOk === null ? '检测中…' : unlockTokenOk ? '统一令牌就绪' : '未配置统一令牌'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            后台解锁验证码由后端真实投递到固定邮箱 <span className="font-mono text-foreground">{cloud.unlockEmail()}</span>：
            本页请求 → GitHub repository_dispatch → 设置仓 unlock-mailer 工作流 → QQ 邮箱 SMTP → 真人收码 → 输入验证码解锁并完全操控管理后台。
            验证码仅哈希留底 10 分钟，明文只存在于真实邮件中；连续错 5 次锁定 10 分钟并记入侵攻击。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={runUnlockSelfTest} disabled={unlockTesting}>
              {unlockTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              发送真人验证码（通道自检）
            </Button>
            {unlockTestMsg && <span className="text-xs text-muted-foreground">{unlockTestMsg}</span>}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">后端就绪清单（三步，缺一则投递失败并提示对应缺失项）</p>
            <p>1. 本页「统一令牌」已配置（需 repo 权限 PAT，用于触发设置仓 dispatches）</p>
            <p>2. 设置仓 {settingsRepo.name} main 分支部署 .github/workflows/unlock-mailer.yml（repository_dispatch 触发）</p>
            <p>3. 设置仓 Secrets 配置 MAIL_USER 与 MAIL_AUTH_CODE（QQ 邮箱 SMTP 授权码）</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            GitHub 云端内容库
            <Badge variant={tokenSaved ? 'outline' : 'secondary'} className={tokenSaved ? 'ml-auto border-emerald-500/40 text-emerald-600' : 'ml-auto'}>
              {tokenSaved ? <><Check className="mr-1 h-3 w-3" /> 令牌已配置</> : '未配置令牌'}
            </Badge>
            <Badge variant={passSaved ? 'outline' : 'secondary'} className={passSaved ? 'border-emerald-500/40 text-emerald-600' : ''}>
              <Lock className="mr-1 h-3 w-3" />
              {passSaved ? '加密已启用' : '未加密'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 统一令牌 */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                <Key className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-700">统一令牌 · 一个钥匙通三仓</div>
                <div className="text-xs text-emerald-600/70">配置一次，内容库 / 用户数据仓 / 设置仓全部可用</div>
              </div>
              {unifiedTokenSaved && (
                <Badge variant="outline" className="ml-auto border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                  <Check className="mr-0.5 h-3 w-3" /> 已配置
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={unifiedTokenInput}
                onChange={(e) => setUnifiedTokenInput(e.target.value)}
                placeholder={unifiedTokenSaved ? '已保存统一令牌（输入新令牌可替换）' : '粘贴 GitHub Personal Access Token'}
                autoComplete="off"
                className="flex-1"
              />
              <Button onClick={handleSaveUnifiedToken} disabled={!unifiedTokenInput.trim() || unifiedTokenBusy}>
                {unifiedTokenBusy ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 保存中
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> 保存
                  </>
                )}
              </Button>
              {unifiedTokenSaved && (
                <Button variant="outline" onClick={handleClearUnifiedToken}>
                  清除
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-emerald-700/70">
              生成方法：
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-emerald-800"
              >
                GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
              </a>
              ，选择三个仓库（22uuuc/6v、22uuuc/fantastic-rotary-phone、22uuuc/moying-settings），Contents 权限设为 Read and write
            </p>
          </div>

          {/* 自动同步状态条 */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {autoSync.enabled && autoSync.status === 'syncing' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : autoSync.enabled && autoSync.status === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : autoSync.enabled ? (
                  <Wifi className="h-4 w-4 text-emerald-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`text-sm font-medium ${autoStatusColor()}`}>
                  {autoStatusLabel()}
                </span>
                {autoSync.status === 'error' && autoSync.lastError && (
                  <span className="text-xs text-destructive/80">— {autoSync.lastError}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncNow}
                  disabled={!autoSync.enabled || autoSync.status === 'syncing'}
                >
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${autoSync.status === 'syncing' ? 'animate-spin' : ''}`} />
                  立即同步
                </Button>
                <Button size="sm" onClick={handleToggleAutoSync} variant={autoSync.enabled ? 'destructive' : 'default'}>
                  {autoSync.enabled ? (
                    <>
                      <X className="mr-1 h-3.5 w-3.5" /> 关闭自动同步
                    </>
                  ) : (
                    <>
                      <Zap className="mr-1 h-3.5 w-3.5" /> 开启自动同步
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              开启后，管理员在后台的任何修改（上架、审核、调整设置等）都会在 3 秒内自动加密推送到 GitHub，无需手动点推送。
            </p>
          </div>

          {/* 令牌权限检测 */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  令牌权限检测
                </div>
                <p className="text-xs text-muted-foreground">一键验证三个仓库的读写权限</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCheckPermissions} disabled={permChecking}>
                {permChecking ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 检测中
                  </>
                ) : (
                  <>
                    <ShieldAlert className="mr-1 h-3.5 w-3.5" /> 检测权限
                  </>
                )}
              </Button>
            </div>
            {permResult && (
              <div className="mt-3 space-y-1 rounded-md border p-3">
                {renderPermItem(permResult.contentRepo)}
                {renderPermItem(permResult.userRepo)}
                {renderPermItem(permResult.settingsRepo)}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="font-medium">仓库</span>
              <span className="font-mono text-xs">{repo.owner} / {repo.name}</span>
              <Badge variant="outline" className="ml-2">分支 {repo.branch}</Badge>
              <Badge className="bg-primary/10 text-primary">固定渠道 · 写死于代码</Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <Database className="mr-1 inline h-3.5 w-3.5" />
              内容库目录 <code className="font-mono">db/</code> · 共 {CLOUD_FILES.length} 个数据文件
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>同步状态</span>
              <span>最后拉取：{lastPullAt || '从未'}</span>
              <span>最后推送：{lastPushAt || '从未'}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              云端传送渠道固定连接已写死在 <code className="font-mono">src/lib/cloud.ts</code>（CLOUD_CHANNEL），
              本地不支持修改；变更渠道只能修改代码并经 GitHub 仓库发布后生效。
            </p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">工作原理（后端管理员控制 · GitHub 数据库中转 · 前端只读提取）</strong>
              ：所有读者/创作者的浏览器每次打开时，都会自动从固定渠道增量拉取共享内容库（书籍/章节/漫画/互动剧本），看到同一份书城。管理员在后台审核上架后，通过令牌加密推送新内容到仓库，前端每次打开自动同步最新内容。
            </p>
            <p>
              前端只拥有匿名拉取（提取）权限，无出口写入权限；所有写入（推送）仅限持令牌的管理员后端，且代码层做了管理员出口权限校验。拉取时验签解密，篡改或损坏的数据会被自动拒收并回退到本地缓存。
            </p>
          </div>

          {/* 数据架构说明 */}
          <div className="rounded-lg border bg-amber-500/5 p-3">
            <div className="mb-2 text-sm font-medium text-amber-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              数据架构 · 三权分离
            </div>
            <div className="space-y-1.5 text-xs text-amber-800/80">
              <p>① <strong>后端（仅开发人员可操作）</strong>：内容库与代码仓库由开发人员持令牌维护——仓库数据加密存储、只有开发者能推送修改，前端用户无法改动软件信息与后端数据。</p>
              <p>② <strong>管理员（运营可操作）</strong>：管理员后台审核内容、管理用户——修改通过令牌加密后推送到云端，前端用户实时同步看到最新内容。</p>
              <p>③ <strong>前端用户（只使用）</strong>：用户只能阅读、购买、收藏——无法修改内容库数据。用户数据存在独立的用户数据仓库。</p>
            </div>
          </div>

          {/* 高级设置：内容库独立令牌 */}
          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>高级设置：内容库独立令牌（已配置统一令牌时无需填写）</span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showAdvanced && (
              <>
                <Label className="text-xs">GitHub 令牌（推送/私有仓库拉取时使用，只保存在本机浏览器）</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={tokenSaved ? '已保存令牌（留空则用已保存的）' : 'ghp_xxx 或 github_pat_xxx'}
                    autoComplete="off"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveToken}
                    disabled={!tokenInput.trim()}
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> 保存
                  </Button>
                  {tokenSaved && (
                    <Button variant="outline" size="sm" onClick={handleClearToken} className="text-destructive">
                      清除
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  如何生成令牌：GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → 选择仓库 {repo.owner}/{repo.name}，勾选 Contents 读写权限。
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    打开生成页 <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>云端加密口令（≥6 位，未设置时禁止推送，防止明文入库）</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder={passSaved ? '已设置加密口令（输入新口令可更换）' : '输入加密口令（≥6 位）'}
                autoComplete="new-password"
              />
              <Button variant="outline" onClick={handleSavePass} disabled={!passInput.trim()}>
                <Lock className="mr-1 h-3.5 w-3.5" /> 保存口令
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              口令只保存在本机浏览器（混淆存储），用于本地派生 AES-GCM / HMAC 密钥。更换口令后，仓库中的旧密文将无法解密（拉取会提示验签失败），请谨慎操作。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={handlePull} disabled={pulling}>
              {pulling ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 拉取中…</>
              ) : (
                <><Download className="mr-1 h-3.5 w-3.5" /> 从云端拉取内容库</>
              )}
            </Button>
            <Button onClick={handlePush} disabled={pushing || !passSaved}>
              {pushing ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 推送中…</>
              ) : (
                <><Upload className="mr-1 h-3.5 w-3.5" /> 加密推送本地内容库</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 用户数据仓库卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            GitHub 用户数据仓库（与内容/代码仓库分离）
            <Badge variant={uTokenSaved ? 'outline' : 'secondary'} className={uTokenSaved ? 'ml-auto border-emerald-500/40 text-emerald-600' : 'ml-auto'}>
              {uTokenSaved ? <><Check className="mr-1 h-3 w-3" /> 令牌已配置</> : '未配置令牌'}
            </Badge>
            <Badge variant={uPassSaved ? 'outline' : 'secondary'} className={uPassSaved ? 'border-emerald-500/40 text-emerald-600' : ''}>
              <Lock className="mr-1 h-3 w-3" />
              {uPassSaved ? '加密已启用' : '未加密'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="font-medium">用户数据仓库</span>
              <span className="font-mono text-xs">{userRepo.owner} / {userRepo.name}</span>
              <Badge variant="outline" className="ml-2">分支 {userRepo.branch}</Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <Database className="mr-1 inline h-3.5 w-3.5" />
              数据目录 <code className="font-mono">db/</code> · 共 {USER_DATA_FILES.length} 个用户数据文件
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>同步状态</span>
              <span>最后拉取：从未</span>
              <span>最后推送：从未</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            与内容库分离存储注册用户、余额、交易流水、收益结算、提现申请、支付配置、资质申请等用户信息数据
            与内容/代码仓库（{repo.owner}/{repo.name}）分开，保障用户隐私和数据安全。
          </p>

          {/* 用户数据仓独立令牌 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-600">💡 已配置统一令牌后，此处无需单独填写。</span>
              如需使用不同的令牌，点击展开：
              <button
                type="button"
                className="ml-1 text-primary hover:underline"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '收起' : '展开高级设置'}
              </button>
            </p>
            {showAdvanced && (
              <>
                <Label className="text-xs">用户数据仓库令牌（推送/拉取时使用，只保存在本机浏览器）</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={uTokenInput}
                    onChange={(e) => setUTokenInput(e.target.value)}
                    placeholder={uTokenSaved ? '已保存令牌（留空则用已保存的）' : 'ghp_xxx 或 github_pat_xxx'}
                    autoComplete="off"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveUserToken}
                    disabled={!uTokenInput.trim()}
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> 保存
                  </Button>
                  {uTokenSaved && (
                    <Button variant="outline" size="sm" onClick={handleClearUserToken} className="text-destructive">
                      清除
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  令牌需对该仓库勾选 Contents 读写权限。
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    打开生成页 <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>用户数据仓库加密口令（≥6 位，独立于内容库口令）</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={uPassInput}
                onChange={(e) => setUPassInput(e.target.value)}
                placeholder={uPassSaved ? '已设置加密口令（输入新口令可更换）' : '输入用户数据仓库加密口令（≥6 位）'}
                autoComplete="new-password"
              />
              <Button variant="outline" onClick={handleSaveUserPass} disabled={!uPassInput.trim()}>
                <Lock className="mr-1 h-3.5 w-3.5" /> 保存口令
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              口令只保存在本机浏览器，用于派生用户数据仓库的 AES-GCM / HMAC 密钥。更换口令后旧密文无法解密，请谨慎操作。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={handlePullUser} disabled={uPulling}>
              {uPulling ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 拉取中…</>
              ) : (
                <><Download className="mr-1 h-3.5 w-3.5" /> 拉取用户数据</>
              )}
            </Button>
            <Button onClick={handlePushUser} disabled={uPushing || !uPassSaved}>
              {uPushing ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 推送中…</>
              ) : (
                <><Upload className="mr-1 h-3.5 w-3.5" /> 加密推送用户数据</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 平台设置仓卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            GitHub 平台设置仓（第三库：排版风格 + 认证会话）
            <Badge variant={sTokenSaved ? 'outline' : 'secondary'} className={sTokenSaved ? 'ml-auto border-emerald-500/40 text-emerald-600' : 'ml-auto'}>
              {sTokenSaved ? <><Check className="mr-1 h-3 w-3" /> 凭证已配置</> : '未配置'}
            </Badge>
            <Badge variant={uPassSaved ? 'outline' : 'secondary'} className={uPassSaved ? 'border-emerald-500/40 text-emerald-600' : ''}>
              <Lock className="mr-1 h-3 w-3" />
              {uPassSaved ? '加密已启用' : '未加密'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="font-medium">平台设置仓</span>
              <span className="font-mono text-xs">{settingsRepo.owner} / {settingsRepo.name}</span>
              <Badge variant="outline" className="ml-2">分支 {settingsRepo.branch}</Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <Database className="mr-1 inline h-3.5 w-3.5" />
              数据目录 <code className="font-mono">db/</code> · 共 {SETTINGS_FILES.length} 个设置文件（settings + authSessions）
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">三仓分离存储</strong>：
            内容/代码仓库（{repo.owner}/{repo.name}）存作品与代码、
            用户数据仓库（{userRepo.owner}/{userRepo.name}）存用户与交易、
            平台设置仓（{settingsRepo.owner}/{settingsRepo.name}）存排版风格、认证会话等全局配置。
            设置仓<strong>复用用户数据仓库的令牌和口令</strong>，无需单独配置。
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={handlePullSettings} disabled={sPulling}>
              {sPulling ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 拉取中…</>
              ) : (
                <><Download className="mr-1 h-3.5 w-3.5" /> 拉取平台设置</>
              )}
            </Button>
            <Button onClick={handlePushSettings} disabled={sPushing || !uPassSaved}>
              {sPushing ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 推送中…</>
              ) : (
                <><Upload className="mr-1 h-3.5 w-3.5" /> 加密推送平台设置</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 一键改口令 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            一键修改加密口令
            <Badge variant="outline" className="ml-auto border-amber-500/40 text-amber-700">
              推荐
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            输入新口令（≥6 位）后点击下方按钮：系统会
            <strong className="text-foreground">自动用新口令重新加密推送内容库、用户数据、平台设置三仓</strong>，
            云端旧密文会被新密文覆盖，完成后旧口令立即失效。
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
              placeholder="输入新口令（≥6 位）"
              autoComplete="new-password"
              className="max-w-xs"
            />
            <Button
              variant="destructive"
              onClick={handleRotatePass}
              disabled={!newPassInput.trim() || rotateBusy}
            >
              {rotateBusy ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 重新加密中…</>
              ) : (
                <><RefreshCw className="mr-1 h-3.5 w-3.5" /> 一键修改并重推三仓</>
              )}
            </Button>
          </div>
          <p className="text-xs text-destructive/80">
            ⚠️ 此操作不可逆。更换后所有历史密文都将失效，请确保你知道新口令。
          </p>
        </CardContent>
      </Card>

      {/* 同步内容清单 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">同步内容清单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="mb-2 font-medium">内容库文件（{repo.owner}/{repo.name}）</div>
            <ul className="space-y-1 text-muted-foreground">
              {CLOUD_FILES.map((f) => (
                <li key={f.key} className="flex items-center gap-2 font-mono text-xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="font-medium text-foreground">{f.key}</span>
                  <span className="text-muted-foreground">{f.path}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 font-medium">用户数据文件（{userRepo.owner}/{userRepo.name}，独立仓库）</div>
            <ul className="space-y-1 text-muted-foreground">
              {USER_DATA_FILES.map((f) => (
                <li key={f.key} className="flex items-center gap-2 font-mono text-xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="font-medium text-foreground">{f.key}</span>
                  <span className="text-muted-foreground">{f.path}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            拉取会覆盖本地数据（云端为权威）；推送会把本地数据加密后写入对应仓库。每份文件推送前加密签名、拉取时验签解密 + 内容查杀，命中危险载荷或验签失败自动拒收。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
