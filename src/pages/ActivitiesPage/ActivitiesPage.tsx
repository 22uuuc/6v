// EXPORTS: ActivitiesPage（组件文件）
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Gift, CalendarClock, Coins, Sparkles, ShieldCheck } from 'lucide-react';
import { api, type ActivityItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  sign: { label: '签到', color: '#16a34a', bg: '#f0fdf4' },
  task: { label: '任务', color: '#2563eb', bg: '#eff6ff' },
  festival: { label: '节日', color: '#e11d48', bg: '#fff1f2' },
  redeem: { label: '兑换', color: '#ea580c', bg: '#fff7ed' },
  admin: { label: '定向', color: '#7c3aed', bg: '#f5f3ff' },
};

function fmtRange(startAt: string, endAt: string) {
  const f = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${f(startAt)} ~ ${f(endAt)}`;
}

export default function ActivitiesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.listActivities();
    if (!res.ok) {
      toast.error(res.msg ?? '活动加载失败');
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(res.activities ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doClaim = async (act: ActivityItem) => {
    if (claiming) return;
    setClaiming(act.id);
    const res = await api.claimActivity(act.id);
    setClaiming('');
    if (!res.ok) {
      toast.error(res.msg ?? '参与失败');
      load();
      return;
    }
    toast.success(`参与成功：+${res.rewardCoins} 币 / +${res.rewardExp} 经验（已发放至账户）`);
    load();
  };

  return (
    <div className="page-enter mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
          <Gift className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-gradient-anime font-serif text-2xl font-bold">活动中心</h1>
        <p className="text-sm text-muted-foreground">
          活动由平台设计并推送，奖励由平台审核后发放到账户
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">活动加载中…</div>
      ) : items.length === 0 ? (
        <Card className="border-dashed bg-muted/30 text-center">
          <CardContent className="py-12">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无进行中的活动，敬请期待</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((act) => {
            const meta = TYPE_META[act.type] ?? { label: '活动', color: '#6b7280', bg: '#f3f4f6' };
            return (
              <Card key={act.id} className="overflow-hidden border-border/60">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                      <h3 className="font-serif text-base font-bold">{act.name}</h3>
                    </div>
                    {act.claimed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                        <ShieldCheck className="h-3 w-3" /> 已参与
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{act.desc}</p>
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-amber-500" /> +{act.rewardCoins} 币
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-violet-500" /> +{act.rewardExp} 经验
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" /> {fmtRange(act.startAt, act.endAt)}
                    </span>
                  </div>
                  <Button
                    className="btn-anime w-full"
                    disabled={act.claimed || claiming === act.id}
                    onClick={() => doClaim(act)}
                  >
                    {act.claimed ? '已参与' : claiming === act.id ? '参与中…' : '参与活动'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
          返回个人中心
        </Button>
      </div>
    </div>
  );
}
