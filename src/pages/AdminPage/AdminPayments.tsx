// EXPORTS: AdminPayments（收款通道配置：支付平台收款码/收款链接直连，无密钥无资质）
// 安全设计：资金直接走支付平台收款码/链接，平台侧完成清算与风控；本后台不维护任何
// 商户密钥、证书、私钥等敏感资质，避免密钥泄露导致资金风险。退款由管理员审核认可后原路实时退回。
import { useState } from 'react';
import {
  Wallet, Smartphone, Landmark, ShieldCheck, CheckCircle2, Save, Link2, MessageSquareWarning, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, maskSecret } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { IPaymentProvider, PaymentProviderId } from '@/lib/types';

const FIELD_META: Record<PaymentProviderId, { key: string; label: string; placeholder: string; desc: string }[]> = {
  wxpay: [
    { key: 'receiveQr', label: '微信收款二维码内容', placeholder: '如 wxp://f2f0/XXXX 或收款码内容', desc: '平台收款码直连，用户扫码后资金直接进入微信商户账户' },
    { key: 'receiveLink', label: '微信收款链接', placeholder: 'https://pay.weixin.qq.com/...', desc: '可选：收款链接，付款方点链接完成支付' },
  ],
  alipay: [
    { key: 'receiveQr', label: '支付宝收款二维码内容', placeholder: '如 https://qr.alipay.com/XXXX', desc: '平台收款码直连，用户扫码后资金直接进入支付宝商户账户' },
    { key: 'receiveLink', label: '支付宝收款链接', placeholder: 'https://qr.alipay.com/...', desc: '可选：收款链接，付款方点链接完成支付' },
  ],
  bankpay: [
    { key: 'receiveQr', label: '银行卡收款二维码内容', placeholder: '如 https://pay.bank.example/transfer?...', desc: '银行代付/收款码直连，资金直接进入对公账户' },
    { key: 'receiveLink', label: '银行卡收款链接', placeholder: 'https://...', desc: '可选：收款链接，付款方点链接完成转账' },
  ],
};

const PROVIDER_ICON: Record<PaymentProviderId, typeof Wallet> = {
  wxpay: Smartphone,
  alipay: Wallet,
  bankpay: Landmark,
};

/** 单平台收款通道配置卡片（只有收款码/链接，无密钥） */
function ProviderCard({ p }: { p: IPaymentProvider }) {
  const [fields, setFields] = useState<Record<string, string>>({ ...p.fields });
  const [enabled, setEnabled] = useState(p.enabled);

  const save = () => {
    const res = api.savePaymentProvider(p.id, fields, enabled);
    if (res.ok) {
      toast.success(`${p.label}收款配置已保存${enabled ? '，已启用' : '，已停用'}`);
    } else {
      toast.error(res.msg ?? '保存失败');
    }
  };

  const Icon = PROVIDER_ICON[p.id];
  const filled = Object.values(fields).filter((v) => v.trim()).length;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? '已启用 · 可发起收款' : '未启用 · 提现不可用该通道'}
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-3">
          {FIELD_META[p.id].map((f) => (
            <div key={f.key}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                className="mt-1 h-8 font-mono text-xs"
                type="text"
                value={fields[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {filled === 0 ? <span>尚未填写收款码，启用后使用演示收款码</span> : <span>已填 {filled} 项 · {Object.values(fields).filter(Boolean).map((v) => maskSecret(v)).join(' · ')}</span>}
          </div>
          <Button size="sm" onClick={save}>
            <Save className="mr-1 h-3.5 w-3.5" /> 保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** 代付/收款记录列表 */
function TransferLog() {
  const list = api.payTransfers();
  if (list.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">还没有收款记录。管理员确认提现到账后会自动生成平台单号。</p>;
  }
  return (
    <div className="space-y-2">
      {list.slice(0, 10).map((t) => (
        <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="font-mono text-xs">{t.tradeNo}</span>
            <span className="text-xs text-muted-foreground">{t.channelLabel}</span>
          </div>
          <span className="font-medium">{t.amount} 元</span>
          <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPayments() {
  useDataVersion();
  const providers = api.paymentProviders();

  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="flex gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div className="space-y-1 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">资金安全模式：平台收款码直连 · 零密钥维护</p>
            <p>
              本后台<strong>不维护任何商户密钥、证书、私钥</strong>。资金收款直接使用<strong>支付平台收款链接 / 收款二维码</strong>：
              付款方扫码或点链接后，资金直接进入平台商户账户，由支付平台完成清算、风控与对账——密钥留在平台侧，管理员无接触密钥，从源头杜绝密钥泄露导致的资金风险。
            </p>
            <p className="text-xs">
              只需两步：① 在下方填入各平台收款二维码内容 / 收款链接（可在微信支付商户、支付宝开放平台、银行代付后台直接复制）；② 开启开关启用该通道。
              提现审核通过后系统按平台收款码实时下发收款二维码；退款由管理员审核认可后原路实时退回。未启用任何通道时，创作者提现会被拦截并提示「平台未启用收款通道」。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">收款记录（提现通过即实时下发）</h3>
          </div>
          <TransferLog />
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p>
          收款链接与收款二维码均要求 http(s) 安全协议，系统会拒绝 javascript: 等注入型地址。
          演示环境下若未配置收款码，提现下发生成演示收款码形态（wxp://f2f0/...、qr.alipay.com/...），接入真实商户后填写真实收款码即生效。
        </p>
      </div>
    </div>
  );
}
