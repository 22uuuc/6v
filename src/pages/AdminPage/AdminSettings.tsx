// EXPORTS: AdminSettings（组件文件）
import { useState } from 'react';
import { Settings2, KeyRound, Save, Wallet, MessageCircle, CreditCard, Zap, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PLATFORM_STYLES, FONT_STYLES } from '@/lib/platform-style';
import type { RechargeMethod, LayoutStyle } from '@/lib/types';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const RECHARGE_METHODS: { id: RechargeMethod; label: string; icon: typeof Wallet }[] = [
  { id: 'alipay', label: '支付宝', icon: Wallet },
  { id: 'wechat', label: '微信支付', icon: MessageCircle },
  { id: 'bank', label: '银行卡', icon: CreditCard },
  { id: 'cloud', label: '云闪付', icon: Zap },
];

export default function AdminSettings() {
  useDataVersion();
  const { user } = useAuth();
  const s = api.getSettings();

  const [siteName, setSiteName] = useState(s.siteName);
  const [announcement, setAnnouncement] = useState(s.announcement);
  const [vipPrice, setVipPrice] = useState(String(s.vipPrice));
  const [rechargeRate, setRechargeRate] = useState(String(s.rechargeRate));
  const [subShare, setSubShare] = useState(String(s.subShare));
  const [tipShare, setTipShare] = useState(String(s.tipShare));
  const [openRegister, setOpenRegister] = useState(s.openRegister);
  const [rechargeMethods, setRechargeMethods] = useState<RechargeMethod[]>(s.rechargeMethods ?? ['alipay', 'wechat', 'bank', 'cloud']);
  const [devWhitelist, setDevWhitelist] = useState((s.devWhitelist ?? []).join(', '));
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>(s.layoutStyle ?? 'anime');
  const [fontFamily, setFontFamily] = useState(s.fontFamily ?? 'system');
  const [fontSize, setFontSize] = useState(String(s.fontSize ?? 18));
  const [lineHeight, setLineHeight] = useState(String(s.lineHeight ?? 1.9));
  const [newCode, setNewCode] = useState('');

  if (!user) return null;

  const save = () => {
    const num = (v: string, min: number, max: number, name: string) => {
      const n = Number(v);
      if (Number.isNaN(n) || n < min || n > max) {
        toast.error(`${name} 不合法`);
        return null;
      }
      return n;
    };
    const vip = num(vipPrice, 0, 100000, 'VIP 价格');
    const rate = num(rechargeRate, 1, 10000, '充值汇率');
    const sub = num(subShare, 0, 1, '订阅分成');
    const tip = num(tipShare, 0, 1, '打赏分成');
    const fsize = num(fontSize, 14, 26, '默认字号');
    const lh = num(lineHeight, 1.2, 2.6, '默认行距');
    if (vip === null || rate === null || sub === null || tip === null || fsize === null || lh === null) return;
    if (rechargeMethods.length === 0) {
      toast.error('至少保留一种充值方式');
      return;
    }
    api.setSettings({
      siteName: siteName.trim() || '墨影书城',
      announcement: announcement.trim(),
      vipPrice: vip,
      rechargeRate: rate,
      subShare: sub,
      tipShare: tip,
      openRegister,
      rechargeMethods,
      devWhitelist: devWhitelist.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      layoutStyle,
      fontFamily,
      fontSize: fsize,
      lineHeight: lh,
    }, user.id);
    toast.success('全站设置已保存，立即生效');
  };

  const changeCode = () => {
    if (newCode.length < 4) {
      toast.error('新安全码至少 4 位');
      return;
    }
    api.setSettings({ adminCode: newCode }, user.id);
    setNewCode('');
    toast.success('管理安全码已更新');
  };

  return (<div className="page-enter grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Settings2 className="h-4 w-4 text-primary" /> 全站设置（管理员可改全站）
          </h3>
          <div className="space-y-1.5">
            <Label>站点名称</Label>
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label>首页公告</Label>
            <Input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} maxLength={80} placeholder="例如：新版本上线，支持漫画传图与动漫视频" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>VIP 价格（币/月）</Label>
              <Input type="number" value={vipPrice} onChange={(e) => setVipPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>充值汇率（币/元）</Label>
              <Input type="number" value={rechargeRate} onChange={(e) => setRechargeRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>订阅分成（0-1）</Label>
              <Input type="number" step="0.05" value={subShare} onChange={(e) => setSubShare(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>打赏分成（0-1）</Label>
              <Input type="number" step="0.05" value={tipShare} onChange={(e) => setTipShare(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>充值方式（用户充值时可选择的支付渠道）</Label>
            <div className="grid grid-cols-2 gap-2">
              {RECHARGE_METHODS.map((m) => {
                const on = rechargeMethods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setRechargeMethods((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                    }
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      on ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <m.icon className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-sm font-medium">{m.label}</span>
                    <span className={`text-xs ${on ? 'text-primary' : 'text-muted-foreground'}`}>{on ? '已启用' : '已停用'}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">停用的方式在用户充值弹窗中不再展示；至少保留一种。</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={openRegister} onChange={(e) => setOpenRegister(e.target.checked)} />
            开放注册（关闭后新用户无法注册，只能登录已有账号）
          </label>
          <div className="space-y-1.5">
            <Label>开发者白名单（用户名，逗号分隔）</Label>
            <Input value={devWhitelist} onChange={(e) => setDevWhitelist(e.target.value)} placeholder="例如：admin, dev001" />
            <p className="text-[11px] text-muted-foreground">
              白名单成员与管理员打开开发者工具（DevTools）属正常调试，不触发反破解告警；非白名单账号触发将记录并在安全中心给出查杀方案。
            </p>
          </div>
          <Button className="gap-1.5" onClick={save}>
            <Save className="h-4 w-4" /> 保存全站设置
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <KeyRound className="h-4 w-4 text-primary" /> 安全码管理
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            当前安全码已启用（哈希存储）。更新后下次进入后台需使用新安全码。
            连续输错 5 次将锁定 10 分钟，并记录入侵攻击日志。
          </p>
          <div className="space-y-1.5">
            <Label>新安全码（≥4 位）</Label>
            <Input type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="输入新安全码" />
          </div>
          <Button variant="outline" className="gap-1.5" onClick={changeCode}>
            <KeyRound className="h-4 w-4" /> 更新安全码
          </Button>
          <p className="text-[11px] text-muted-foreground">
            提示：演示环境使用前端哈希校验，真实生产环境建议服务端加密存储与登录态强校验。
          </p>
        </CardContent>
      </Card>

      {/* 平台排版风格（管理员可替换全站风格，立即生效） */}
      <Card className="lg:col-span-2">
        <CardContent className="space-y-3 p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Palette className="h-4 w-4 text-primary" /> 平台排版风格（管理员可替换）
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            每个风格是<b>配色 + 圆角 + 字体 + 氛围装饰</b>的完整设计体系，不只是换颜色：选择风格并保存，全部读者页面立即切换（含背景光晕、飘落装饰、卡片圆角与默认字体）。
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.values(PLATFORM_STYLES).map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setLayoutStyle(st.key)}
                className={`rounded-xl border p-3 text-left transition ${layoutStyle === st.key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: st.vars['--primary'] }} />
                  <span className="text-sm font-medium">{st.label}</span>
                  {layoutStyle === st.key && <Badge className="ml-auto text-[10px]">当前</Badge>}
                </div>
                <p className="mb-1.5 text-[11px] leading-4 text-muted-foreground">{st.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {st.tags.map((t) => (
                    <span key={t} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>平台默认阅读字体</Label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              >
                {FONT_STYLES.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>默认字号（14-26px）</Label>
              <Input type="number" min={14} max={26} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>默认行距（1.2-2.6）</Label>
              <Input type="number" min={1.2} max={2.6} step={0.1} value={lineHeight} onChange={(e) => setLineHeight(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            排版风格与字体偏好同步进入「平台数据库」（GitHub 第三库 moying-settings 的 settings 文件），云同步后换设备保持一致。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
