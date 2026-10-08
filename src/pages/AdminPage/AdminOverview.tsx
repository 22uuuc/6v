// EXPORTS: AdminOverview（组件文件）
import ReactECharts from 'echarts-for-react';
import { Users, BookOpen, CheckCircle2, Landmark, Clock3, Crown, Banknote, ShieldAlert, Hourglass, MessageSquareText, Wallet, Zap } from 'lucide-react';
import { api, rechargeMethodLabel } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { CHART_HEX } from '@/components/chart-colors';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AdminOverview() {
  useDataVersion();
  const stats = api.adminStats();
  const recharges = api.realtimeRecharges(12);

  const lineOption = {
    color: [CHART_HEX[0], CHART_HEX[2]],
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['新增用户', '平台收入(元)'], textStyle: { color: '#8f9aa8' }, top: 0 },
    grid: { left: 40, right: 16, top: 34, bottom: 24 },
    xAxis: { type: 'category' as const, data: stats.series.map((s) => s.label), axisLabel: { color: '#8f9aa8' }, axisLine: { lineStyle: { color: '#333a52' } } },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: '#8f9aa8' } },
    series: [
      { name: '新增用户', type: 'line' as const, smooth: true, data: stats.series.map((s) => s.users), areaStyle: { opacity: 0.18 }, symbolSize: 6 },
      { name: '平台收入(元)', type: 'line' as const, smooth: true, data: stats.series.map((s) => Math.round(s.income * 100) / 100), symbolSize: 6 },
    ],
  };

  const pieOption = {
    color: CHART_HEX,
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { color: '#8f9aa8' } },
    series: [
      {
        name: '收入构成',
        type: 'pie' as const,
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        itemStyle: { borderRadius: 6, borderColor: '#0a0e16', borderWidth: 2 },
        label: { color: '#c8cdd6' },
        data: [
          { name: '充值流水', value: Math.round(stats.rechargeYuan * 100) / 100 },
          { name: '订阅分成', value: stats.subscribeYuan },
          { name: '打赏分成', value: stats.tipYuan },
        ],
      },
    ],
  };

  const cards = [
    { icon: Users, label: '注册用户', value: stats.userCount, sub: `${stats.vipUsers} 位 VIP` },
    { icon: BookOpen, label: '作品总量', value: stats.bookCount, sub: `${stats.publishedCount} 部已上架` },
    { icon: Clock3, label: '待审作品', value: stats.pendingBooks, sub: `${stats.applicantPending} 个创作者资质待审` },
    { icon: Landmark, label: '充值流水', value: `${stats.rechargeYuan} 元`, sub: `平台留存 ${stats.platformIncome} 元` },
  ];

  const secCards = [
    { icon: Hourglass, label: '待结算收益', value: `${stats.settlePending} 币`, sub: '审核通过后入创作者可提现余额' },
    { icon: Banknote, label: '已结算收益', value: `${stats.settleApproved} 币`, sub: '已进入创作者余额' },
    { icon: Hourglass, label: '待审核提现', value: `${stats.withdrawPending} 元`, sub: `${stats.channelPending} 个渠道待审 · 冻结资金待放款` },
    { icon: ShieldAlert, label: '危险内容标记', value: stats.flaggedCount, sub: `${stats.featuredCount} 部编辑推荐` },
    { icon: MessageSquareText, label: '反馈工单', value: stats.feedbackPending, sub: `${stats.supportUnread} 条客服未读消息` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="card-anime">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </span>
                {c.label}
              </p>
              <p className="mt-3 text-3xl font-bold tracking-tight">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {secCards.map((c) => (
          <Card key={c.label} className={c.label.includes('危险') ? 'border-destructive/40' : ''}>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/70 text-foreground/80">
                  <c.icon className="h-3.5 w-3.5" />
                </span>
                {c.label}
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-1 flex items-center gap-1.5 font-medium">
              <Crown className="h-4 w-4 text-primary" /> 近 7 日趋势
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">新增用户与平台收入（充值抽成 30%）</p>
            <ReactECharts option={lineOption} style={{ height: 300 }} notMerge />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-1 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" /> 收入构成
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">充值 / 订阅分成 / 打赏分成</p>
            <ReactECharts option={pieOption} style={{ height: 300 }} notMerge />
          </CardContent>
        </Card>
      </div>

      {/* 实时收款：用户支付实时到账（管理员实时可见） */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-1 flex items-center gap-1.5 font-medium">
            <Zap className="h-4 w-4 text-primary" /> 实时收款 · 用户支付即时到账
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">用户扫码支付成功后，回调实时入账并出现在这里（含支付方式与平台单号），提现由客服审核实时下发。</p>
          {recharges.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">暂无充值订单，用户支付后这里实时出现</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {recharges.map(({ tx, user }) => (
                <div key={tx.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Wallet className="h-3 w-3" /> 到账
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {user ? `${user.nickname}（@${user.username}）` : '用户'} · {tx.amount.toFixed(2)} 元
                    <span className="ml-2 text-xs text-muted-foreground">{rechargeMethodLabel(tx.method ?? 'alipay')}</span>
                    {tx.payNo && <span className="ml-2 font-mono text-[10px] text-muted-foreground">单号 {tx.payNo}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{fmtTime(tx.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
