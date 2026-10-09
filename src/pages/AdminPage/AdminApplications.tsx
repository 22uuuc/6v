// EXPORTS: AdminApplications（创作者资质审核）
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { BadgeCheck, Clock3, ShieldX, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IApplicant } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话小说', game: '游戏' };

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

export default function AdminApplications() {
  useDataVersion();
  const { user } = useAuth();
  const [note, setNote] = useState('');

  const all = useMemo(() => (user ? api.allApplications() : []), [user]);
  const pending = all.filter((a) => a.status === 'pending');
  const handled = all.filter((a) => a.status !== 'pending');

  if (!user) return null;

  const decide = (app: IApplicant, ok: boolean) => {
    if (!ok && !note.trim()) {
      toast.error('驳回时请填写原因');
      return;
    }
    api.decideApplication(app.id, ok, user.id, note.trim());
    setNote('');
    toast.success(ok ? `已通过《${app.workTitle}》，创作者身份已开通` : `已驳回 ${app.nickname} 的申请`);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">待审资质</p>
            <p className="mt-1 text-xl font-bold">{pending.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">累计申请</p>
            <p className="mt-1 text-xl font-bold">{all.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">已开通创作者</p>
            <p className="mt-1 text-xl font-bold">{handled.filter((a) => a.status === 'approved').length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Clock3 className="h-4 w-4 text-primary" /> 待审核资质（{pending.length}）
          </h3>
          {pending.length === 0 ? (
            <EmptyState text="暂无待审核的创作者申请" className="py-8" />
          ) : (
            pending.map((app) => (
              <div key={app.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">待审核</Badge>
                  <span className="text-sm font-medium">{app.nickname}</span>
                  <span className="text-xs text-muted-foreground">@{app.userId} · 申请于 {fmtTime(app.createdAt)}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">资质说明：</span>{app.reason}</p>
                  <p>
                    <span className="text-muted-foreground">首部作品：</span>
                    《{app.workTitle}》（{TYPE_LABEL[app.workType]}）
                  </p>
                  <p className="text-muted-foreground">{app.workIntro}</p>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">驳回原因（驳回时必填）</Label>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：资质材料不足，请补充后重新申请" maxLength={80} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => decide(app, false)}>
                      <ShieldX className="h-3.5 w-3.5" /> 驳回
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => decide(app, true)}>
                      <BadgeCheck className="h-3.5 w-3.5" /> 通过并开通创作者
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <UserCheck className="h-4 w-4 text-primary" /> 已处理记录（{handled.length}）
          </h3>
          {handled.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无已处理的申请</p>
          ) : (
            handled.map((app) => (
              <div key={app.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <Badge variant={app.status === 'approved' ? 'default' : 'outline'} className="w-14 justify-center text-[10px]">
                  {app.status === 'approved' ? '已通过' : '已驳回'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{app.nickname} · 《{app.workTitle}》</p>
                  <p className="truncate text-[11px] text-muted-foreground">{app.note ?? '无备注'} · {fmtTime(app.handledAt ?? app.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
