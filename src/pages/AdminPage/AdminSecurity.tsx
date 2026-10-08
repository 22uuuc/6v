// EXPORTS: AdminSecurity（组件文件）
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ShieldCheck, ShieldAlert, Bug, ScanSearch, Trash2, CheckCircle2, ScrollText, Activity, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { security } from '@/lib/security';
import { deepScan, guardStats } from '@/lib/guard';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

export default function AdminSecurity() {
  useDataVersion();
  const { user } = useAuth();
  const logs = security.logs();
  const audits = security.audits();
  const flagged = logs.filter((l) => l.status === 'flagged');
  const danger = logs.some((l) => l.level === 'danger' && l.status === 'flagged');
  const gstats = guardStats();

  if (!user) return null;

  const runScan = () => {
    const n = api.scanAll();
    if (n > 0) {
      toast.warning(`扫描完成，发现 ${n} 处危险内容，请尽快隔离处理`);
    } else {
      toast.success('全站扫描完成，未发现危险内容');
    }
  };

  const runDeepScan = () => {
    const r = deepScan();
    const parts: string[] = [];
    if (r.virusFlags > 0) parts.push(`病毒/注入 ${r.virusFlags} 处`);
    if (r.tamperedRepaired > 0) parts.push(`自动修复篡改 ${r.tamperedRepaired} 处`);
    if (r.sessionBroken) parts.push('会话被破坏已重置');
    if (parts.length === 0) parts.push('全部干净');
    toast.success(`深度查杀完成：${parts.join('，')}`);
  };

  const doQuarantine = (targetId: string) => {
    api.quarantine(targetId, user.id);
    toast.success('已隔离危险作品：下架 + 清除内容 + 封禁作者');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" /> 安全中心
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            入侵与病毒代码警告 · 全站内容查杀 · 数据防篡改（签名校验）· 操作审计
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={runScan}>
          <ScanSearch className="h-4 w-4" /> 全站查杀
        </Button>
      </div>

      {danger && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldAlert className="h-6 w-6 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">检测到 {flagged.length} 处危险内容/病毒代码注入</p>
              <p className="text-xs text-destructive/80">
                来源可能为：脚本注入（script/javascript:）、事件属性劫持（onload/onerror）、数据篡改（签名不匹配）、后台暴力破解。请逐条处理或隔离作品。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">安全日志（{logs.length}）</TabsTrigger>
          <TabsTrigger value="audits">操作审计（{audits.length}）</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-3 pt-3">
          {logs.length === 0 ? (
            <EmptyState text="暂无安全日志，系统运行平稳" />
          ) : (
            logs.slice(0, 40).map((l) => {
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Badge variant={l.level === 'danger' ? 'default' : 'secondary'} className="w-14 justify-center text-[10px]">
                    {l.level === 'danger' ? '危险' : '可疑'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.message}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {l.kind === 'tamper' ? '数据篡改' : l.kind === 'attack' ? '入侵攻击' : l.kind === 'suspicious' ? '破解行为·开发者模式' : '内容注入'} · {l.targetType}/{l.field}
                      {l.snippet ? ` · "${l.snippet}"` : ''} · {fmtTime(l.createdAt)}
                    </p>
                  </div>
                  {l.status === 'flagged' && (
                    <div className="flex gap-1.5">
                      {l.targetType !== 'system' && (
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => doQuarantine(l.targetId)}>
                          <Trash2 className="h-3.5 w-3.5" /> 隔离作品
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => { api.ignoreSecurityLog(l.id); toast.success('已标记为忽略'); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> 忽略
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="audits" className="space-y-3 pt-3">
          {audits.length === 0 ? (
            <EmptyState text="暂无操作审计记录" />
          ) : (
            audits.slice(0, 40).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {a.action} <span className="text-primary">{a.target}</span>
                    {a.detail ? <span className="text-muted-foreground">（{a.detail}）</span> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{a.userName} · {fmtTime(a.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-1.5 font-medium">
              <Activity className="h-4 w-4 text-primary" /> 防篡改守护
            </h3>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={runDeepScan}>
              <RefreshCcw className="h-4 w-4" /> 立即深度查杀
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">守护状态</p>
              <p className="mt-0.5 flex items-center gap-1 font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> 运行中
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">上次巡检</p>
              <p className="mt-0.5 font-medium">{gstats.lastScanAt ? fmtTime(gstats.lastScanAt) : '—'}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">自动修复</p>
              <p className="mt-0.5 font-medium">{gstats.repaired} 次</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">深度查杀</p>
              <p className="mt-0.5 font-medium">{gstats.deepScans} 次</p>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] leading-5 text-muted-foreground">
            每 30 秒自动巡检全库签名；所有写入同时保留 shadow 备份，篡改一经发现立即自动恢复并记录日志；
            其他页面直接改写本地数据（绕过本应用）也会被监控并修复。危险内容与入侵尝试将同步展示在全站顶部横幅。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Bug className="h-4 w-4 text-primary" /> 数据库防篡改说明
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            所有数据写入时附加哈希签名并同步 shadow 备份，读取时校验签名，不匹配即自动从备份恢复；无备份可用时记录「数据篡改」日志并拒绝采用被篡改数据（数据库护死）。
            管理安全码采用哈希存储，连续输错 5 次锁定 10 分钟并记录入侵攻击。充值 / 提现 / 收益结算全程流水留痕、管理员审核、审计可查。
            <span className="mt-1 block text-[11px] text-muted-foreground/70">
              注：此为前端演示级防护（localStorage + IndexedDB + 哈希签名），真实生产环境需服务端鉴权与数据库层防护。
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
