// EXPORTS: EarningsPage（组件文件）
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowLeft, Landmark, Coins, Wallet, CheckCircle2, Plus, CreditCard, QrCode as QrIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, fmtYuan, channelLabel, maskAccount } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/EmptyState';
import QrCode from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChannelType, PaymentProviderId, IWithdrawal } from '@/lib/types';

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

const WD_META: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' }> = {
  pending: { label: '审核中', variant: 'outline' },
  done: { label: '已到账', variant: 'default' },
  rejected: { label: '已驳回', variant: 'secondary' },
};

const CH_META: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' }> = {
  pending: { label: '渠道审核中', variant: 'outline' },
  approved: { label: '已通过', variant: 'default' },
  rejected: { label: '已驳回', variant: 'secondary' },
};

export default function EarningsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDataVersion();
  const [amount, setAmount] = useState('');
  const [wdOpen, setWdOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [chOpen, setChOpen] = useState(false);
  const [chType, setChType] = useState<ChannelType>('alipay');
  const [chAccount, setChAccount] = useState('');
  const [chName, setChName] = useState('');
  const [chBank, setChBank] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderId | ''>('');
  const [qrWd, setQrWd] = useState<IWithdrawal | null>(null);

  const stats = useMemo(
    () => (user ? api.creatorStats(user.id) : { income: 0, pending: 0, books: 0, fans: 0 }),
    [user],
  );
  const rewards = useMemo(() => (user ? api.txsOf(user.id).filter((t) => t.kind === 'reward') : []), [user]);
  const withdrawals = useMemo(() => (user ? api.withdrawalsOf(user.id) : []), [user]);
  const settlements = useMemo(() => (user ? api.settlementsOf(user.id) : []), [user]);
  const channels = useMemo(() => (user ? api.myChannels(user.id) : []), [user]);
  const approvedChannel = channels.find((c) => c.status === 'approved');
  const payProviders = useMemo(() => (user ? api.paymentProviders() : []), [user]);
  const enabledProviders = payProviders.filter((p) => p.enabled);

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return <p className="py-20 text-center text-sm text-muted-foreground">收益中心仅对创作者开放</p>;
  }

  const doneAmount = withdrawals.filter((w) => w.status === 'done').reduce((s, w) => s + w.amount, 0);
  const settlePending = settlements.filter((s) => s.status === 'pending').reduce((s, x) => s + x.amount, 0);

  const ST_META: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' }> = {
    pending: { label: '待审核', variant: 'outline' },
    approved: { label: '已通过', variant: 'default' },
    rejected: { label: '已驳回', variant: 'secondary' },
  };

  const openWdDialog = () => {
    if (channels.length === 0 || !approvedChannel) {
      toast.error('请先绑定提现渠道并等待管理员审核通过');
      setChOpen(true);
      return;
    }
    setSelectedChannel(approvedChannel.id);
    const first = enabledProviders[0];
    setSelectedProvider(first ? first.id : '');
    if (!first) {
      toast.error('平台尚未启用代付通道，请联系管理员在后台「支付对接」中配置');
      return;
    }
    setWdOpen(true);
  };

  const requestWd = () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error('请输入正确的提现金额');
      return;
    }
    if (!selectedProvider) {
      toast.error('请选择代付通道（需管理员已启用）');
      return;
    }
    const res = api.requestWithdraw(user.id, n, selectedChannel, confirmPwd, selectedProvider);
    if (!res.ok) {
      toast.error(res.msg ?? '提现失败');
      return;
    }
    setWdOpen(false);
    setAmount('');
    setConfirmPwd('');
    setSelectedProvider('');
    toast.success('提现申请已提交，等待管理员审核');
  };

  const saveChannel = () => {
    const res = api.saveChannel(user.id, {
      type: chType,
      account: chAccount,
      accountName: chName,
      bankName: chType === 'bank' ? chBank : undefined,
    });
    if (!res.ok) {
      toast.error(res.msg ?? '保存失败');
      return;
    }
    setChOpen(false);
    setChAccount('');
    setChName('');
    setChBank('');
    toast.success('提现渠道已提交，等待管理员审核通过后即可提现');
  };

  return (<div className="page-enter mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creator')} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="font-serif text-xl font-bold">收益中心</h1>
          <p className="text-xs text-muted-foreground">订阅分成 · 打赏 100% · VIP 创作者 +10% · 收益经管理员审核后进入可提现余额</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Coins className="h-3.5 w-3.5" /> 累计收益</p>
            <p className="mt-1 text-xl font-bold text-primary">{fmtYuan(stats.income)} 元</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> 可提现</p>
            <p className="mt-1 text-xl font-bold">{fmtYuan(stats.pending)} 元</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> 已提现</p>
            <p className="mt-1 text-xl font-bold">{doneAmount.toFixed(2)} 元</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Landmark className="h-3.5 w-3.5" /> 作品数</p>
            <p className="mt-1 text-xl font-bold">{stats.books}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">提现渠道</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                绑定支付宝 / 微信 / 银行卡，管理员审核通过后方可提现
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setChOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {channels.length > 0 ? '新增/修改渠道' : '绑定渠道'}
            </Button>
          </div>
          {channels.length === 0 ? (
            <EmptyState text="还没有提现渠道，绑定一个开始提现" className="py-6" />
          ) : (
            <div className="mt-3 space-y-2">
              {channels.map((c) => {
                const meta = CH_META[c.status] ?? CH_META.pending;
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {channelLabel(c.type)}
                        {c.bankName ? ` · ${c.bankName}` : ''}
                        <span className="ml-2 font-normal text-muted-foreground">{maskAccount(c.account)}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{c.accountName}{c.note ? ` · ${c.note}` : ''}</p>
                    </div>
                    <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">提现</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              当前可提现 {fmtYuan(stats.pending)} 元，满 1 元即可申请，管理员审核后由代付平台到账
              {approvedChannel ? ` · 到账渠道：${channelLabel(approvedChannel.type)}（${maskAccount(approvedChannel.account)}）` : ' · 请先绑定提现渠道'}
              {enabledProviders.length > 0
                ? ` · 代付通道：${enabledProviders.map((p) => p.label).join(' / ')}`
                : ' · 代付通道未启用（需管理员后台配置）'}
            </p>
          </div>
          <Button onClick={openWdDialog} disabled={stats.pending < 100}>
            申请提现
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-1 font-medium">收益结算</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            每笔订阅 / 打赏先进入「待审核」结算单，管理员审核通过后才会计入可提现余额（收益保护机制）。
            当前待审核：{fmtYuan(settlePending)} 元
          </p>
          {settlements.length === 0 ? (
            <EmptyState text="暂无结算记录" className="py-6" />
          ) : (
            <div className="divide-y divide-border">
              {settlements.slice(0, 12).map((s) => {
                const meta = ST_META[s.status] ?? ST_META.pending;
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    <Badge variant={meta.variant} className="w-14 justify-center text-[10px]">{meta.label}</Badge>
                    <p className="min-w-0 flex-1 truncate text-sm">{s.note}</p>
                    <span className="text-sm font-medium text-success">+{s.amount} 币</span>
                    <span className="hidden w-20 text-right text-[11px] text-muted-foreground sm:block">{fmtTime(s.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-medium">收益明细</h2>
          {rewards.length === 0 ? (
            <EmptyState text="暂无收益记录" className="py-8" />
          ) : (
            <div className="divide-y divide-border">
              {rewards.slice(0, 15).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <Badge variant="outline" className="w-14 justify-center text-[10px]">分成</Badge>
                  <p className="min-w-0 flex-1 truncate text-sm">{t.note}</p>
                  <span className="text-sm font-medium text-success">+{t.coin} 币</span>
                  <span className="hidden w-20 text-right text-[11px] text-muted-foreground sm:block">{fmtTime(t.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-medium">提现记录</h2>
          {withdrawals.length === 0 ? (
            <EmptyState text="暂无提现记录" className="py-8" />
          ) : (
            <div className="divide-y divide-border">
              {withdrawals.map((w) => {
                const meta = WD_META[w.status] ?? WD_META.pending;
                const provider = payProviders.find((p) => p.id === w.providerId);
                return (
                  <div key={w.id} className="flex items-center gap-3 py-2.5">
                    <Badge variant={meta.variant} className="w-16 justify-center text-[10px]">{meta.label}</Badge>
                    <p className="flex-1 text-sm">
                      {w.amount.toFixed(2)} 元
                      {provider && (
                        <span className="ml-2 text-[11px] text-muted-foreground">{provider.label}</span>
                      )}
                      {w.payTradeNo && (
                        <span className="ml-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">单号 {w.payTradeNo}</span>
                      )}
                    </p>
                    {w.channel && (
                      <span className="hidden text-[11px] text-muted-foreground sm:inline">
                        {channelLabel(w.channel.type)} · {maskAccount(w.channel.account)}
                      </span>
                    )}
                    {w.payQrContent && w.status === 'done' && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setQrWd(w)}>
                        <QrIcon className="h-3.5 w-3.5 text-primary" /> 收款码
                      </Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">{fmtTime(w.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={wdOpen} onOpenChange={setWdOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>申请提现</DialogTitle>
            <DialogDescription>
              可提现余额：{fmtYuan(stats.pending)} 元（1 元 = 100 书币，演示环境模拟审核）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>提现渠道</Label>
              <div className="space-y-1.5">
                {channels.filter((c) => c.status === 'approved').map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChannel(c.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedChannel === c.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="flex-1">{channelLabel(c.type)}{c.bankName ? ` · ${c.bankName}` : ''}</span>
                    <span className="text-xs text-muted-foreground">{maskAccount(c.account)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>代付通道（由管理员后台配置对接）</Label>
              {enabledProviders.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  暂无可用的代付通道，请联系管理员在「支付对接」中配置并启用
                </p>
              ) : (
                <div className="space-y-1.5">
                  {enabledProviders.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProvider(p.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedProvider === p.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="flex-1">{p.label}</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">已启用</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>提现金额（元）</Label>
              <Input
                type="number"
                min={1}
                max={Math.floor(stats.pending / 100)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="至少 1 元"
              />
              <p className="text-[11px] text-muted-foreground">风控规则：单笔 ≤ 500 元 · 每日最多 3 次</p>
            </div>
            <div className="space-y-1.5">
              <Label>登录密码（安全二次验证）</Label>
              <Input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="输入登录密码确认本人操作"
                maxLength={32}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWdOpen(false)}>取消</Button>
            <Button onClick={requestWd} disabled={!confirmPwd}>提交申请</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrWd !== null} onOpenChange={(o) => { if (!o) setQrWd(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>收款二维码</DialogTitle>
            <DialogDescription>
              {qrWd ? `${qrWd.amount.toFixed(2)} 元 · ${qrWd.payTradeNo ?? ''}（实时下发，扫码收款）` : ''}
            </DialogDescription>
          </DialogHeader>
          {qrWd?.payQrContent && (
            <div className="flex flex-col items-center gap-2 py-2">
              <QrCode text={qrWd.payQrContent} size={168} />
              <p className="max-w-full break-all text-center font-mono text-[10px] text-muted-foreground">
                {qrWd.payQrContent}
              </p>
              <p className="text-center text-[11px] text-muted-foreground">
                演示环境模拟平台收款码 · 真实下发由服务端调用支付平台 API 生成
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setQrWd(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chOpen} onOpenChange={setChOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>绑定提现渠道</DialogTitle>
            <DialogDescription>
              提交后需管理员审核通过，通过前不能用于提现
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>渠道类型</Label>
              <Select value={chType} onValueChange={(v) => setChType(v as ChannelType)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="选择渠道" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alipay">支付宝</SelectItem>
                  <SelectItem value="wechat">微信</SelectItem>
                  <SelectItem value="bank">银行卡</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>收款账号（{chType === 'alipay' ? '手机号/邮箱' : chType === 'wechat' ? '微信号' : '银行卡号'}）</Label>
              <Input value={chAccount} onChange={(e) => setChAccount(e.target.value)} placeholder="收款账号" />
            </div>
            <div className="space-y-1.5">
              <Label>收款人姓名</Label>
              <Input value={chName} onChange={(e) => setChName(e.target.value)} placeholder="与账号实名一致" />
            </div>
            {chType === 'bank' && (
              <div className="space-y-1.5">
                <Label>开户行</Label>
                <Input value={chBank} onChange={(e) => setChBank(e.target.value)} placeholder="如：中国工商银行 合肥支行" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChOpen(false)}>取消</Button>
            <Button onClick={saveChannel}>提交审核</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
