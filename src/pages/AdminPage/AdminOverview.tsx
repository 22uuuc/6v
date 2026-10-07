// EXPORTS: AdminOverview（组件文件）
import ReactECharts from 'echarts-for-react';
import { Users, BookOpen, CheckCircle2, Landmark, Clock3, Crown, Banknote, ShieldAlert, Hourglass, MessageSquareText } from 'lucide-react';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { CHART_HEX } from '@/components/chart-colors';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminOverview() {
  useDataVersion();
  const stats = api.adminStats();

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </p>
              <p className="mt-1 text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {secCards.map((c) => (
          <Card key={c.label} className={c.label.includes('危险') ? 'border-destructive/40' : ''}>
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </p>
              <p className="mt-1 text-xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 font-medium">
              <Crown className="h-4 w-4 text-primary" /> 近 7 日趋势
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">新增用户与平台收入（充值抽成 30%）</p>
            <ReactECharts option={lineOption} style={{ height: 280 }} notMerge />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" /> 收入构成
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">充值 / 订阅分成 / 打赏分成</p>
            <ReactECharts option={pieOption} style={{ height: 280 }} notMerge />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
