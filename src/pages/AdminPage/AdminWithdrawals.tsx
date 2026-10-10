// EXPORTS: AdminWithdrawals（组件文件）
import { useState } from 'react';
import { Check, X, Clock3, Landmark, QrCode as QrIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, channelLabel, maskAccount } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/EmptyState';
import QrCode from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { IWithdrawal } from '@/lib/types';

export default function AdminWithdrawals() {
  useDataVersion();
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [qrWd, setQrWd] = useState<IWithdrawal | null>(null);
  const all = api.allWithdrawals();
  const pending = all.filter((w) => w.status === 'pending');
  const done = all.filter((w) => w.status !== 'pending');
  const channels = api.allChannels();
  const chPending = channels.filter((c) => c.status === 'pending');
  const chHistory = channels.filter((c) => c.status !== 'pending');
  const providers = api.paymentProviders();
  const providerOf = (id?: string) => providers.find((p) => p.id === id);

  if (!user) return null;

  const decideCh = (id: string, ok: boolean) => {
    api.decideChannel(id, ok, user.id, ok ? undefined : note.trim() || '渠道信息不合规');
    setNote('');
    toast.success(ok ? '渠道已通过审核，创作者可正常提现' : '渠道已驳回，创作者可修改后重新提交');
  };

  return (<div className="page-enter space-y-6">
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-medium">
          提现渠道审核（{chPending.length}）
          <span className="text-xs font-normal text-muted-foreground">创作者绑定的收款渠道，通过后方可提现</span>
        </h3>
        {chPending.length === 0 ? (
          <EmptyState text="没有待审核的提现渠道" className="py-6" />
        ) : (
          <div className="space-y-2">
            {chPending.map((c) => {
              const u = api.getUser(c.userId);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Landmark className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {channelLabel(c.type)}
                      {c.bankName ? ` · ${c.bankName}` : ''} · <span className="text-primary">{maskAccount(c.account)}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      收款人 {c.accountName} · {u ? `${u.nickname}（@${u.username}）` : '用户已注销'} · {c.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="驳回原因（选填）"
                      className="h-8 w-32 rounded-md border border-border bg-background px-2 text-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => decideCh(c.id, false)}>
                        <X className="h-3.5 w-3.5" /> 驳回
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => decideCh(c.id, true)}>
                        <Check className="h-3.5 w-3.5" /> 通过
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-medium">
          待审核提现（{pending.length}）
          <span className="text-xs font-normal text-muted-foreground">创作者提现申请，到账渠道已固化</span>
        </h3>
        {pending.length === 0 ? (
          <EmptyState text="没有待审核的提现" className="py-8" />
        ) : (
          <div className="space-y-2">
            {pending.map((w) => {
              const u = api.getUser(w.userId);
              const p = providerOf(w.providerId);
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Clock3 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {w.amount.toFixed(2)} 元
                      {p && <span className="ml-2 text-xs text-muted-foreground">{p.label}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {u ? `${u.nickname}（@${u.username}）` : '用户已注销'} · {w.createdAt.slice(0, 10)}
                      {w.channel ? ` · 到账 ${channelLabel(w.channel.type)} ${maskAccount(w.channel.account)}（${w.channel.accountName}）` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => { api.decideWithdrawal(w.id, 'rejected', user.id); toast.success('已驳回，冻结资金已退回创作者余额'); }}>
                      <X className="h-3.5 w-3.5" /> 驳回
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => { api.decideWithdrawal(w.id, 'done', user.id); toast.success('已确认打款，代付平台单号已生成'); }}>
                      <Check className="h-3.5 w-3.5" /> 确认到账
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-medium">渠道记录（{chHistory.length}）</h3>
        {chHistory.length === 0 ? (
          <EmptyState text="暂无渠道记录" className="py-6" />
        ) : (
          <div className="space-y-2">
            {chHistory.map((c) => {
              const u = api.getUser(c.userId);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <p className="flex-1 truncate text-sm">
                    {channelLabel(c.type)}
                    {c.bankName ? ` · ${c.bankName}` : ''} · {maskAccount(c.account)}（{c.accountName}）
                  </p>
                  <p className="text-xs text-muted-foreground">{u ? u.nickname : ''}</p>
                  <Badge variant={c.status === 'approved' ? 'default' : 'secondary'}>{c.status === 'approved' ? '已通过' : '已驳回'}</Badge>
                  <span className="text-[11px] text-muted-foreground">{c.createdAt.slice(0, 10)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-medium">提现历史（{done.length}）</h3>
        {done.length === 0 ? (
          <EmptyState text="暂无历史提现" className="py-8" />
        ) : (
          <div className="space-y-2">
            {done.map((w) => {
              const u = api.getUser(w.userId);
              const p = providerOf(w.providerId);
              return (
                <div key={w.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <p className="flex-1 text-sm">
                    {w.amount.toFixed(2)} 元
                    {p && <span className="ml-2 text-xs text-muted-foreground">{p.label}</span>}
                    {w.payTradeNo && <span className="ml-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{w.payTradeNo}</span>}
                    {w.payQrContent && w.status === 'done' && (
                      <Button size="sm" variant="outline" className="ml-1 h-7 gap-1 px-2 text-[11px]" onClick={() => setQrWd(w)}>
                        <QrIcon className="h-3.5 w-3.5 text-primary" /> 收款码
                      </Button>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u ? u.nickname : ''}</p>
                  <Badge variant={w.status === 'done' ? 'default' : 'secondary'}>{w.status === 'done' ? '已到账' : '已驳回'}</Badge>
                  <span className="text-[11px] text-muted-foreground">{w.createdAt.slice(0, 10)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={qrWd !== null} onOpenChange={(o) => { if (!o) setQrWd(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>收款二维码（实时下发）</DialogTitle>
            <DialogDescription>
              {qrWd ? `${qrWd.amount.toFixed(2)} 元 · ${qrWd.payTradeNo ?? ''} · ${providerOf(qrWd.providerId)?.label ?? ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          {qrWd?.payQrContent && (
            <div className="flex flex-col items-center gap-2 py-2">
              <QrCode text={qrWd.payQrContent} size={168} />
              <p className="max-w-full break-all text-center font-mono text-[10px] text-muted-foreground">{qrWd.payQrContent}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
