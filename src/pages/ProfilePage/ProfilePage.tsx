// EXPORTS: ProfilePage（组件文件）
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Crown, Wallet, PenLine, ShieldCheck, LogOut, Coins, PencilLine,
  ArrowRight, BadgeCheck, Landmark, MessageCircle, CreditCard, Zap,
  MessageSquareText, Headset, EyeOff, Lock, Trash2, BookOpenText, KeyRound,
  RotateCcw, Palette, MonitorSmartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api, isVip, fmtCoins, rechargeMethodLabel } from '@/lib/api';
import { FONT_STYLES } from '@/lib/platform-style';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { avatarSVG } from '@/lib/svg';
import EmptyState from '@/components/EmptyState';
import QrCode from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ITx, IPrivacy, IUserPrefs } from '@/lib/types';
import { LEVELS } from '@/lib/types';

const RECHARGE_AMOUNTS = [
  { yuan: 6, coins: 600 },
  { yuan: 12, coins: 1200 },
  { yuan: 30, coins: 3000 },
  { yuan: 68, coins: 6800 },
];

/** 隐私开关项 */
const PRIVACY_ITEMS: { key: keyof IPrivacy; label: string; desc: string }[] = [
  { key: 'hideBalance', label: '隐藏书币余额', desc: '个人中心不展示余额数字' },
  { key: 'hideRecent', label: '隐藏最近阅读', desc: '首页与个人中心不展示最近在读' },
  { key: 'hideShelf', label: '隐藏书架', desc: '书架内容对外不可见' },
  { key: 'hideRecords', label: '隐藏收支记录', desc: '流水明细对外不可见' },
  { key: 'stealth', label: '隐身模式', desc: '不展示在线/活跃状态，阅读不产生公开足迹' },
];

/** 充值方式（图标 + 说明） */
const RECHARGE_METHODS = [
  { id: 'alipay', label: '支付宝', desc: '推荐', icon: Wallet },
  { id: 'wechat', label: '微信支付', desc: '常用', icon: MessageCircle },
  { id: 'bank', label: '银行卡', desc: '储蓄卡/信用卡', icon: CreditCard },
  { id: 'cloud', label: '云闪付', desc: '快捷', icon: Zap },
] as const;

const TX_LABEL: Record<string, string> = {
  recharge: '充值',
  subscribe: '订阅',
  tip: '打赏',
  vip: 'VIP',
  reward: '分成',
  withdraw: '提现',
  settle: '签到/任务',
};

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

/** 生成第三方收银台订单（模拟下单：订单号 + 收款二维码内容），模块级避免渲染纯度检查 */
function genPayOrder(method: string, yuan: number): { no: string; qr: string } {
  const no = `R${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  const rand = Math.random().toString(36).slice(2, 12).toUpperCase();
  const qr =
    method === 'wechat'
      ? `wxp://f2f0/${rand}?amount=${yuan}`
      : method === 'bank'
        ? `https://pay.bank.example/charge?out=${no}&amt=${yuan}`
        : `https://qr.alipay.com/${rand}?amount=${yuan}`;
  return { no, qr };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDataVersion();
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [vipOpen, setVipOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [rechargeMethod, setRechargeMethod] = useState<string>('alipay');
  const [payStep, setPayStep] = useState<'idle' | 'qr' | 'done'>('idle');
  const [payAmount, setPayAmount] = useState(0);
  const [payNo, setPayNo] = useState('');
  const [payQr, setPayQr] = useState('');
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  // 个性化偏好（字体/字号/行距）
  const [prefsOpen, setPrefsOpen] = useState(false);
  const myPrefs = user ? api.getPrefs(user.id) : {};
  const [pfFont, setPfFont] = useState(myPrefs.fontFamily ?? 'system');
  const [pfSize, setPfSize] = useState(String(myPrefs.fontSize ?? 18));
  const [pfLine, setPfLine] = useState(String(myPrefs.lineHeight ?? 1.9));
  // 账号安全（认证状态 + 登录设备）
  const [secOpen, setSecOpen] = useState(false);
  const sessions = user ? api.mySessions(user.id) : [];
  const authLevel = user?.authLevel ?? (user ? api.authLevelOf(user) : 0);

  const checkinInfo = useMemo(
    () => (user ? api.checkinInfo(user.id) : { today: false, streak: 0, readDone: false, checkinReward: 10, readReward: 5 }),
    [user],
  );

  if (!user) {
    return (
      <div className="py-20">
        <EmptyState text="还没有登录" />
        <div className="flex justify-center">
          <Button onClick={() => navigate('/auth')}>去登录 / 注册</Button>
        </div>
      </div>
    );
  }

  const txs = api.txsOf(user.id);
  const vip = isVip(user);
  const settings = api.getSettings();
  const privacy: IPrivacy = { hideBalance: false, hideRecent: false, hideShelf: false, hideRecords: false, stealth: false, ...(user.privacy ?? {}) };
  const level = LEVELS.find((l) => l.level === user.level) ?? LEVELS[0];
  const nextLevel = LEVELS.find((l) => l.level === user.level + 1);
  const levelProgress = nextLevel ? Math.min(100, Math.round((user.exp / nextLevel.need) * 100)) : 100;

  const doRecharge = (yuan: number) => {
    // 收银台：点击金额后生成收款二维码（模拟第三方收银台下单），扫码支付成功后由回调到账
    const { no, qr } = genPayOrder(rechargeMethod, yuan);
    setPayAmount(yuan);
    setPayNo(no);
    setPayQr(qr);
    setPayStep('qr');
  };

  const confirmPaid = () => {
    if (!payAmount || !payNo) return;
    api.recharge(user.id, payAmount, rechargeMethod, payNo);
    setRechargeOpen(false);
    setPayStep('idle');
    setPayAmount(0);
    setPayNo('');
    setPayQr('');
    toast.success(`支付成功，到账 ${fmtCoins(payAmount * settings.rechargeRate)} 书币（单号 ${payNo}）`);
  };

  const doBuyVip = () => {
    const res = api.buyVip(user.id);
    if (!res.ok) {
      toast.error(res.msg ?? '开通失败');
      return;
    }
    setVipOpen(false);
    toast.success('VIP 开通成功，全站付费内容免费看');
  };

  const saveProfile = () => {
    api.updateProfile(user.id, { nickname: nickname.trim() || user.nickname, bio: bio.trim() });
    setEditOpen(false);
    toast.success('已保存');
  };

  const txFilter = (kind: string) =>
    txs.filter((t) => (kind === 'all' ? true : t.kind === kind));

  const doCheckin = () => {
    if (!user) return;
    const res = api.checkin(user.id);
    if (!res.ok) {
      toast.error(res.msg ?? '签到失败');
      return;
    }
    setStampKey((k) => k + 1); // 触发盖章动画
    toast.success(`签到成功！连续 ${res.streak} 天，+${res.reward} 书币`);
  };

  const doChangePwd = () => {
    if (!user) return;
    if (newPwd !== newPwd2) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    const res = api.changePassword(user.id, oldPwd, newPwd);
    if (!res.ok) {
      toast.error(res.msg ?? '修改失败');
      return;
    }
    setPwdOpen(false);
    setOldPwd('');
    setNewPwd('');
    setNewPwd2('');
    toast.success('密码已修改，请牢记新密码');
  };

  const doSavePrefs = () => {
    if (!user) return;
    const size = Number(pfSize);
    const line = Number(pfLine);
    if (Number.isNaN(size) || size < 14 || size > 26) {
      toast.error('字号需在 14-26 之间');
      return;
    }
    if (Number.isNaN(line) || line < 1.2 || line > 2.6) {
      toast.error('行距需在 1.2-2.6 之间');
      return;
    }
    const prefs: IUserPrefs = { fontFamily: pfFont, fontSize: size, lineHeight: line };
    api.setPrefs(user.id, prefs);
    setPrefsOpen(false);
    toast.success('个性化已保存，阅读页立即生效');
  };

  return (
    <div className="space-y-5">
      {/* 用户卡 */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-[0_0_0_2px_hsl(333_92%_66%/0.45),0_0_18px_-2px_hsl(275_84%_62%/0.5)] ring-1 ring-border/50">
              <div dangerouslySetInnerHTML={{ __html: avatarSVG(user.id, user.nickname) }} />
              {vip && (
                <span className="absolute bottom-0 left-0 right-0 bg-primary/90 py-0.5 text-center text-[9px] font-bold text-primary-foreground">
                  VIP
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-serif text-lg font-bold">{user.nickname}</h1>
                {vip && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                @{user.username}
                <Badge variant="outline" className="text-[10px]">
                  {user.role === 'admin' ? '管理员' : user.role === 'creator' ? '创作者' : '读者'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{user.bio || '这个人还没有写简介'}</p>
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setNickname(user.nickname); setBio(user.bio ?? ''); setEditOpen(true); }} className="gap-1.5">
              <PencilLine className="h-3.5 w-3.5" /> 编辑资料
            </Button>
            {user.role === 'reader' && (
              <Button
                size="sm"
                className="btn-anime gap-1.5"
                onClick={() => {
                  navigate('/creator');
                }}
              >
                <PenLine className="h-3.5 w-3.5" /> 成为创作者
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 等级 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(9_88%_52%/0.18)] to-[hsl(12_92%_60%/0.18)] font-serif text-lg font-bold text-primary">
              Lv.{user.level}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {level.name}
                {user.level >= 6 && <span className="ml-2 text-xs text-primary">已满级</span>}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-[hsl(9_88%_52%)] to-[hsl(12_92%_60%)] transition-all" style={{ width: `${levelProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {nextLevel
                  ? `经验 ${user.exp} / ${nextLevel.need} · 距「${nextLevel.name}」还需 ${Math.max(0, nextLevel.need - user.exp)} 经验`
                  : '经验值已拉满，感谢一路相伴'}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            经验来源：发布作品 +50 · 订阅/打赏收入 +5 · 作品被收藏 +3 · 开通 VIP +20 · 登录 +10。等级越高，优质作品越容易被管理员推荐流量。
          </p>
        </CardContent>
      </Card>

      {/* 每日任务：签到 + 阅读 */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                <Zap className="h-4 w-4 text-primary" /> 每日任务
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                连续签到 {checkinInfo.streak} 天 · 签到 +{checkinInfo.checkinReward} 币 · 阅读一章 +{checkinInfo.readReward} 币
              </p>
            </div>
            <button
              key={stampKey}
              type="button"
              onClick={doCheckin}
              disabled={checkinInfo.today}
              aria-label="每日签到"
              className={cn(
                'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                checkinInfo.today
                  ? 'stamp-seal border-red-500/70 bg-red-500/10 text-red-500'
                  : 'border-red-400/60 text-red-400 hover:scale-105 hover:bg-red-500/10',
              )}
            >
              <span className="font-serif text-base font-bold">{checkinInfo.today ? '已签' : '签'}</span>
              {checkinInfo.today && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${checkinInfo.today ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              <BadgeCheck className="h-3.5 w-3.5" /> 每日签到 {checkinInfo.today ? '✓ 已完成' : '未完成'}
            </span>
            <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${checkinInfo.readDone ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              <BookOpenText className="h-3.5 w-3.5" /> 今日阅读一章 {checkinInfo.readDone ? '✓ 已完成' : '未完成'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* VIP + 钱包 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className={vip ? 'border-primary/50' : ''}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">墨影 VIP</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {vip
                  ? `生效至 ${user.vipUntil ? format(new Date(user.vipUntil), 'yyyy-MM-dd', { locale: zhCN }) : '长期'}`
                  : '付费章节、互动小说、漫画全部免费看'}
              </p>
            </div>
            {vip ? (
              <Badge>已开通</Badge>
            ) : (
              <Button size="sm" onClick={() => setVipOpen(true)}>开通（{fmtCoins(settings.vipPrice)}/月）</Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Coins className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">我的书币</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {privacy.hideBalance ? (
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> 余额已隐藏（隐私设置）
                  </span>
                ) : (
                  <>
                    余额 <span className="text-base font-bold text-primary">{fmtCoins(user.coins)}</span> 币 · 支持订阅与打赏
                  </>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRechargeOpen(true)} className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> 充值
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 入口 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(user.role === 'creator' || user.role === 'admin') && (
          <>
            <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => navigate('/creator')}>
              <CardContent className="flex items-center gap-3 p-4">
                <PenLine className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">创作者中心</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => navigate('/creator/earnings')}>
              <CardContent className="flex items-center gap-3 p-4">
                <Landmark className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">收益中心</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </>
        )}
        {user.role === 'admin' && (
          <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => navigate('/admin')}>
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">管理后台</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        )}
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => navigate('/feedback')}>
          <CardContent className="flex items-center gap-3 p-4">
            <MessageSquareText className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">意见反馈</span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => navigate('/support')}>
          <CardContent className="flex items-center gap-3 p-4">
            <Headset className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">联系客服</span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => setPrivacyOpen(true)}>
          <CardContent className="flex items-center gap-3 p-4">
            <EyeOff className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">隐私设置</span>
            {privacy.stealth || privacy.hideBalance || privacy.hideRecent || privacy.hideShelf || privacy.hideRecords ? (
              <Badge className="ml-auto">已开启 {Object.values(privacy).filter(Boolean).length} 项</Badge>
            ) : (
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            )}
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => setPwdOpen(true)}>
          <CardContent className="flex items-center gap-3 p-4">
            <KeyRound className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">修改密码</span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => { setPfFont(myPrefs.fontFamily ?? 'system'); setPfSize(String(myPrefs.fontSize ?? 18)); setPfLine(String(myPrefs.lineHeight ?? 1.9)); setPrefsOpen(true); }}>
          <CardContent className="flex items-center gap-3 p-4">
            <Palette className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">个性化排版</span>
            <Badge className="ml-auto" variant="outline">字体·字号·行距</Badge>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => setSecOpen(true)}>
          <CardContent className="flex items-center gap-3 p-4">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">账号安全</span>
            <Badge className="ml-auto" variant={authLevel >= 2 ? 'default' : 'outline'}>
              {authLevel === 0 ? '未认证' : authLevel === 1 ? '基础认证' : '完整认证'}
            </Badge>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => { api.logout(); navigate('/'); }}>
          <CardContent className="flex items-center gap-3 p-4">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">退出登录</span>
          </CardContent>
        </Card>
      </div>

      {/* 明细 */}
      <Card>
        <CardContent className="p-4">
          {privacy.hideRecords ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Lock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">收支记录已设为隐私，对外不可见</p>
              <p className="text-xs text-muted-foreground/70">可在「隐私设置」中随时关闭隐藏</p>
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="recharge">充值</TabsTrigger>
                <TabsTrigger value="subscribe">订阅</TabsTrigger>
                <TabsTrigger value="tip">打赏</TabsTrigger>
                <TabsTrigger value="reward">分成</TabsTrigger>
              </TabsList>
              {(['all', 'recharge', 'subscribe', 'tip', 'reward'] as const).map((k) => (
                <TabsContent key={k} value={k}>
                  {txFilter(k).length === 0 ? (
                    <EmptyState text="暂无记录" className="py-8" />
                  ) : (
                    <div className="divide-y divide-border">
                      {txFilter(k).slice(0, 12).map((t: ITx) => (
                        <div key={t.id} className="flex items-center gap-3 py-2.5">
                          <Badge variant="outline" className="w-12 justify-center text-[10px]">
                            {TX_LABEL[t.kind]}
                          </Badge>
                          <p className="min-w-0 flex-1 truncate text-sm">{t.note}</p>
                          {t.kind === 'recharge' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 shrink-0 gap-1 px-2 text-[10px]"
                              onClick={() => {
                                const res = api.submitFeedback(user.id, {
                                  type: 'refund',
                                  title: `退款申请：${t.note}`,
                                  content: `订单 ${t.id} · ${t.amount} 元，申请原路退回。请客服核实处理。`,
                                  contact: user.username,
                                  refund: { txId: t.id, yuan: t.amount, coin: t.coin },
                                });
                                if (res.ok) {
                                  toast.success('退款申请已提交客服渠道，管理员处理后会回复你');
                                  navigate('/support');
                                } else {
                                  toast.error(res.msg ?? '提交失败');
                                }
                              }}
                            >
                              <RotateCcw className="h-3 w-3" /> 申请退款
                            </Button>
                          )}
                          <span className={`shrink-0 text-sm font-medium ${t.coin >= 0 ? 'text-success' : 'text-foreground'}`}>
                            {t.coin >= 0 ? '+' : ''}{t.coin > 0 ? fmtCoins(t.coin) : t.coin} 币
                          </span>
                          <span className="hidden w-20 shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                            {fmtTime(t.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* 隐私设置弹窗 */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>隐私与安全</DialogTitle>
            <DialogDescription>控制你的账号对外可见度与数据管理，变更实时生效</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {PRIVACY_ITEMS.map((item) => {
              const on = privacy[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/40"
                  onClick={() => {
                    api.savePrivacy(user.id, { [item.key]: !on });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.desc}</span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted'}`}
                    aria-hidden
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">清除阅读历史</p>
                <p className="text-[11px] text-muted-foreground">删除全部阅读进度记录，不可恢复</p>
              </div>
              {confirmClear ? (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setConfirmClear(false)}>取消</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => {
                      api.clearHistory(user.id);
                      setConfirmClear(false);
                      setPrivacyOpen(false);
                      toast.success('阅读历史已清除');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 确认清除
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfirmClear(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> 清除
                </Button>
              )}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            隐私说明：你的书币余额、最近阅读、书架、收支记录仅在本机浏览器中保存；开启隐藏后这些信息将不在页面公开展示。隐身模式下，阅读行为不会产生对外可见的足迹。
          </p>
          <DialogFooter>
            <Button onClick={() => setPrivacyOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 充值弹窗（收银台：选方式 → 扫码支付 → 回调到账） */}
      <Dialog open={rechargeOpen} onOpenChange={(o) => { setRechargeOpen(o); if (!o) setPayStep('idle'); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{payStep === 'qr' ? '扫码支付' : '充值书币'}</DialogTitle>
            <DialogDescription>
              {payStep === 'qr'
                ? `订单 ${payNo} · ${payAmount} 元（${rechargeMethodLabel(rechargeMethod)}）`
                : `1 元 = ${fmtCoins(settings.rechargeRate)} 书币 · 收款二维码扫码支付，支付成功后回调到账`}
            </DialogDescription>
          </DialogHeader>
          {payStep === 'qr' ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4">
                <QrCode text={payQr} size={168} />
                <p className="max-w-full break-all text-center font-mono text-[10px] text-muted-foreground">{payQr}</p>
                <p className="text-xs text-muted-foreground">
                  演示环境：展示收款二维码，确认「支付成功」后由回调到账；真实环境由支付平台回调服务器验签后入账
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setPayStep('idle')}>取消</Button>
                <Button onClick={confirmPaid}>模拟支付成功（回调到账）</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">充值方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {RECHARGE_METHODS.filter((m) => (settings.rechargeMethods ?? []).includes(m.id)).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setRechargeMethod(m.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                        rechargeMethod === m.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <m.icon className="h-4 w-4 text-primary" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{m.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{m.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {RECHARGE_AMOUNTS.map((r) => (
                  <Button key={r.yuan} variant="outline" className="flex-col gap-0.5 py-3" onClick={() => doRecharge(r.yuan)}>
                    <span className="text-base font-bold">{r.yuan} 元</span>
                    <span className="text-xs text-muted-foreground">{fmtCoins(r.coins)} 币</span>
                  </Button>
                ))}
              </div>
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                金额交易安全说明：支付走第三方收银台（微信支付 / 支付宝），到账以平台回调为准；
                单笔充值有风控校验，异常订单可走客服渠道申请退款。充值记录会进入平台流水（含支付方式与单号）。
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* VIP 弹窗 */}
      <Dialog open={vipOpen} onOpenChange={setVipOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>开通墨影 VIP</DialogTitle>
            <DialogDescription>
              月度 VIP：{fmtCoins(settings.vipPrice)} 书币 / 月
              <br />
              权益：全站付费内容免费阅读 · 打赏与订阅优先支持
              <br />
              当前余额：{fmtCoins(user.coins)} 书币
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVipOpen(false)}>再想想</Button>
            <Button onClick={doBuyVip}>立即开通</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑资料 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑资料</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>昵称</Label>
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} />
            </div>
            <div className="space-y-1.5">
              <Label>简介</Label>
              <Input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={60} placeholder="一句话介绍自己" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={saveProfile}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              需要验证原密码，修改成功后下次登录请使用新密码（至少 6 位）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>原密码</Label>
              <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="当前登录密码" />
            </div>
            <div className="space-y-1.5">
              <Label>新密码</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="至少 6 位" maxLength={32} />
            </div>
            <div className="space-y-1.5">
              <Label>确认新密码</Label>
              <Input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} placeholder="再输入一次" maxLength={32} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>取消</Button>
            <Button onClick={doChangePwd} disabled={!oldPwd || !newPwd || !newPwd2}>
              <KeyRound className="mr-1 h-4 w-4" /> 确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 个性化排版弹窗：字体/字号/行距（阅读页即时生效） */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>个性化排版</DialogTitle>
            <DialogDescription>选择你习惯的阅读字体、字号与行距，仅对本人生效</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>阅读字体</Label>
              <select
                value={pfFont}
                onChange={(e) => setPfFont(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                {FONT_STYLES.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>字号（14-26px）</Label>
                <Input type="number" min={14} max={26} value={pfSize} onChange={(e) => setPfSize(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>行距（1.2-2.6）</Label>
                <Input type="number" min={1.2} max={2.6} step={0.1} value={pfLine} onChange={(e) => setPfLine(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              阅读页右上角可快速切换墨夜 / 纸感 / 深夜主题，同样会记住你的选择。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrefsOpen(false)}>取消</Button>
            <Button onClick={doSavePrefs}>
              <Palette className="mr-1 h-4 w-4" /> 保存偏好
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 账号安全弹窗：认证状态 + 登录设备管理 */}
      <Dialog open={secOpen} onOpenChange={setSecOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>账号安全</DialogTitle>
            <DialogDescription>身份认证等级与登录设备管理（仅本人可见）</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" /> 身份认证等级
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={authLevel >= 2 ? 'default' : 'outline'}>
                  {authLevel === 0 ? '未认证' : authLevel === 1 ? '基础认证' : '完整认证'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {authLevel === 2
                    ? '邮箱 + 手机均已验证'
                    : authLevel === 1
                      ? '已完成一项验证（邮箱/手机）'
                      : '尚未完成任何验证'}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                注册与找回密码均需邮箱验证码校验；认证等级越高，账号可信度与资金操作保护越强。
              </p>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <MonitorSmartphone className="h-4 w-4 text-primary" /> 登录设备（{sessions.length}）
              </p>
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无设备记录</p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-foreground">{s.device}</p>
                        <p className="text-[10px] text-muted-foreground">
                          最近登录 {format(new Date(s.lastAt), 'MM-dd HH:mm')}
                        </p>
                      </div>
                      {s.id === sessions[0]?.id && <Badge variant="default" className="shrink-0 text-[10px]">当前</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setSecOpen(false)}>关闭</Button>
            <Button
              onClick={() => {
                if (!user || sessions.length === 0) return;
                api.killOtherSessions(user.id, sessions[0].id, user.id);
                toast.success('已退出其他登录设备（当前设备保留）');
              }}
              disabled={sessions.length <= 1}
            >
              <MonitorSmartphone className="mr-1 h-4 w-4" /> 退出其他设备
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
