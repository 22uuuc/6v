// EXPORTS: AdminSettlements（组件文件）
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ISettlement } from '@/lib/types';

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' }> = {
  pending: { label: '待审核', variant: 'outline' },
  approved: { label: '已通过', variant: 'default' },
  rejected: { label: '已驳回', variant: 'secondary' },
};

export default function AdminSettlements() {
  useDataVersion();
  const { user } = useAuth();
  const list = api.allSettlements();
  const pendingCount = list.filter((s) => s.status === 'pending').length;

  if (!user) return null;

  const decide = (s: ISettlement, ok: boolean) => {
    api.decideSettlement(s.id, ok, user.id);
    toast.success(ok ? `已通过 ${s.amount} 币结算，计入创作者可提现余额` : `已驳回 ${s.amount} 币结算`);
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Banknote className="h-4 w-4 text-primary" /> 收益结算审核
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            创作者每笔订阅 / 打赏分成先生成「待结算」单，审核通过后才会进入其可提现余额；驳回则收益不发放（收益保护机制）。
            当前待审核 <span className="font-medium text-primary">{pendingCount}</span> 笔。
          </p>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState text="暂无结算单，读者订阅或打赏后生成" />
      ) : (
        list.slice(0, 30).map((s) => {
          const meta = STATUS_META[s.status] ?? STATUS_META.pending;
          const author = api.getUser(s.userId);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <Badge variant={meta.variant} className="w-16 justify-center text-[10px]">{meta.label}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.note}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  创作者：{author?.nickname ?? s.userId} · {fmtTime(s.createdAt)}
                  {s.decidedAt ? ` · 处理于 ${fmtTime(s.decidedAt)}` : ''}
                </p>
              </div>
              <span className="text-sm font-medium text-success">+{s.amount} 币</span>
              {s.status === 'pending' && (
                <div className="flex gap-1.5">
                  <Button size="sm" className="gap-1" onClick={() => decide(s, true)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> 通过
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => decide(s, false)}>
                    <XCircle className="h-3.5 w-3.5" /> 驳回
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
