// EXPORTS: AdminSecurity（组件文件）
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ShieldCheck, ShieldAlert, Bug, ScanSearch, Trash2, CheckCircle2, ScrollText, Activity, RefreshCcw, Wrench, BrainCircuit, Globe, ExternalLink, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { security, threatProfile, popPendingRemedy } from '@/lib/security';
import { deepScan, guardPatrol, guardStats, adaptiveResponse, approveRemedy, cleanupResolvedFlags } from '@/lib/guard';
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
  const profile = threatProfile();
  const casualCount = Object.values(profile.cells).filter((c) => c.verdict === 'casual').length;
  const attackCount = Object.values(profile.cells).filter((c) => c.verdict === 'attack').length;

  if (!user) return null;

  const confirmRemedy = (logId: string) => {
    const r = approveRemedy(logId, user.id);
    if (r.ok) toast.success(r.msg ?? '已执行处置'); else toast.error(r.msg ?? '执行失败');
  };

  /** 日志状态徽章：未处理的危险=红、可疑=黄；已清理/已解决=绿、已忽略=灰（查杀后红色显示消失） */
  const badgeOf = (l: { status: string; level: string }): { label: string; cls: string } => {
    if (l.status === 'cleaned') return { label: '已清理', cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400' };
    if (l.status === 'resolved') return { label: '已解决', cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400' };
    if (l.status === 'ignored') return { label: '已忽略', cls: 'border-border bg-muted text-muted-foreground' };
    if (l.level === 'danger') return { label: '危险', cls: 'border-destructive/50 bg-destructive/15 text-destructive' };
    return { label: '可疑', cls: 'border-amber-400/40 bg-amber-500/10 text-amber-400' };
  };

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
    const cleaned = cleanupResolvedFlags(); // 查杀后清理红色显示
    if (cleaned > 0) parts.push(`已清理 ${cleaned} 条告警的红色显示`);
    toast.success(`深度查杀完成：${parts.join('，')}`);
  };

  /** 修复机制：立即执行全库巡检，从 shadow 备份恢复被篡改数据 */
  const runRepair = () => {
    const r = guardPatrol();
    if (r.repaired > 0) {
      toast.success(`修复完成：已从备份恢复 ${r.repaired} 处被篡改数据`);
    } else if (r.damage.length > 0) {
      toast.warning(`发现 ${r.damage.length} 处损坏且无备份可恢复，已被隔离拒绝采用`);
    } else {
      toast.success('全库巡检完成，数据签名全部一致，未被篡改');
    }
  };

  /** 一键执行修复方案：深度查杀 + 全库修复 + 清理红色显示（对应告警类型给出处置） */
  const runRemedy = () => {
    const d = deepScan();
    const p = guardPatrol();
    const parts: string[] = [];
    if (d.virusFlags > 0) parts.push(`已查杀危险内容 ${d.virusFlags} 处`);
    if (p.repaired > 0) parts.push(`已修复被篡改数据 ${p.repaired} 处`);
    if (p.damage.length > 0) parts.push(`隔离损坏数据 ${p.damage.length} 处`);
    if (d.sessionBroken) parts.push('已重置被破坏的会话');
    if (parts.length === 0) parts.push('全站干净，无需修复');
    const cleaned = cleanupResolvedFlags();
    if (cleaned > 0) parts.push(`已清理 ${cleaned} 条告警红色显示`);
    toast.success(`修复方案执行完毕：${parts.join('，')}`);
  };

  /** 针对告警类型的查杀方案说明（展示在每条日志下方） */
  const remedyFor = (kind: string): string => {
    if (kind === 'tamper') return '修复方案：数据签名校验失败，系统已自动从 shadow 备份恢复；无备份时损坏数据被隔离拒绝采用。点击「立即修复」可再执行一轮全库修复。';
    if (kind === 'xss') return '查杀方案：检测到脚本/事件属性注入载荷，已拦截访问痕迹；对作品内容可执行「隔离作品」（下架+清除内容+封禁作者）。';
    if (kind === 'attack') return '查杀方案：检测到暴力破解/入侵尝试（安全码、登录爆破、开发者工具+篡改组合），已记录入侵警告并限频防刷；带账号身份的攻击记录可直接「封禁攻击账号」，从源头阻断攻击者。';
    if (kind === 'suspicious') return '修复方案：开发者工具告警。管理员可在「全站设置 → 开发者白名单」加入该账号用户名以豁免正常调试；非白名单账号打开开发者工具仍会记录。';
    return '处置建议：忽略（确认无风险）或隔离相关作品。';
  };

  const doQuarantine = (targetId: string) => {
    api.quarantine(targetId, user.id);
    toast.success('已隔离危险作品：下架 + 清除内容 + 封禁作者');
  };

  /** 针对病毒/攻击者本身：封禁留痕的攻击账号，使其无法再登录（管理员权限） */
  const doBan = (targetId: string) => {
    api.setBanned(targetId, true, user.id);
    toast.success('已封禁攻击账号，该账号将无法再登录');
  };

  return (<div className="page-enter space-y-4">
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
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <ShieldAlert className="h-6 w-6 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">检测到 {flagged.length} 处危险内容/病毒代码注入</p>
              <p className="text-xs text-destructive/80">
                来源可能为：脚本注入（script/javascript:）、事件属性劫持（onload/onerror）、数据篡改（签名不匹配）、后台暴力破解。请逐条处理或隔离作品。
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { const n = cleanupResolvedFlags(); toast.success(n > 0 ? `已清理 ${n} 条已处理告警的红色显示` : '没有可清理的已处理告警'); }}>
                <CheckCircle2 className="h-4 w-4" /> 清理红色显示
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={runRemedy}>
                <Wrench className="h-4 w-4" /> 一键执行修复方案（查杀+修复）
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {!danger && logs.length > 0 && (
        <Card className="border-emerald-400/40 bg-emerald-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-400">全部告警已处理，界面恢复平静</p>
              <p className="text-xs text-emerald-400/70">历史告警已清理 / 忽略 / 处置完成，无未处理的危险内容；系统持续守护中。</p>
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
            <EmptyState text="暂无安全日志，系统运行平稳" mood="happy" />
          ) : (
            logs.slice(0, 40).map((l) => {
              return (
                <div key={l.id} className={`flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 ${l.status !== 'flagged' ? 'opacity-60' : ''}`}>
                  <Badge className={`w-14 justify-center border text-[10px] ${badgeOf(l).cls}`}>{badgeOf(l).label}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.message}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {l.kind === 'tamper' ? '数据篡改' : l.kind === 'attack' ? '入侵攻击' : l.kind === 'suspicious' ? '破解行为·开发者模式' : '内容注入'} · {l.targetType}/{l.field}
                      {l.snippet ? ` · "${l.snippet}"` : ''} · {fmtTime(l.createdAt)}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-primary/80">{remedyFor(l.kind)}</p>
                  </div>
                  {l.status === 'flagged' && (
                    <div className="flex flex-wrap gap-1.5">
                      {l.kind === 'tamper' && (
                        <Button size="sm" variant="outline" className="gap-1 text-emerald-400" onClick={runRepair}>
                          <Wrench className="h-3.5 w-3.5" /> 立即修复
                        </Button>
                      )}
                      {/* 封禁攻击账号：日志带真实账号身份时直接打击攻击者（病毒载荷/爆破来源） */}
                      {l.targetType === 'user' && l.targetId && (
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => doBan(l.targetId)}>
                          <Ban className="h-3.5 w-3.5" /> 封禁攻击账号
                        </Button>
                      )}
                      {l.targetType !== 'system' && l.targetType !== 'user' && l.targetType !== 'anon' && (
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
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={runRepair}>
                <Wrench className="h-4 w-4" /> 立即巡检修复
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={runDeepScan}>
                <RefreshCcw className="h-4 w-4" /> 立即深度查杀
              </Button>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-1.5 font-medium">
              <BrainCircuit className="h-4 w-4 text-primary" /> 成长性修复方案（威胁画像 · 意外 / 故意自动判定 · 处置权限归管理员）
            </h3>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
              const n = adaptiveResponse();
              toast.success(n > 0 ? `已识别 ${n} 条「故意入侵」并生成处置方案，待你确认后执行` : '当前无需要处置的告警（意外/误操作不会被误伤）');
            }}>
              <Wrench className="h-4 w-4" /> 检测并生成处置方案
            </Button>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">识别为「意外 / 误操作」</p>
              <p className="mt-0.5 font-medium text-amber-400">{casualCount} 类来源</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">首次 / 低频触发：仅记录并温和提示，不误伤正常使用</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">识别为「故意入侵」</p>
              <p className="mt-0.5 font-medium text-destructive">{attackCount} 类来源</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">同一来源 10 分钟内高频触发：自动隔离 / 清除 / 封禁并留痕</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">已学习的入侵特征</p>
              <p className="mt-0.5 font-medium text-primary">{profile.learnedPatterns.length} 条</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {profile.learnedPatterns.length > 0 ? profile.learnedPatterns.slice(0, 3).join('、') : '暂未遇到新变体'}
                {profile.learnedPatterns.length > 3 ? '…' : ''}
              </p>
            </div>
          </div>
          <div className="mt-2.5 rounded-lg border border-border/60 bg-muted/40 p-2.5 text-[11px] leading-5 text-muted-foreground">
            <p>
              判定逻辑：同一位来源（作品 / 章节 / 系统行为）在 <b>10 分钟内</b>触发告警 <b>≥ 3 次</b>判定为「故意入侵」，系统自动 <b>生成处置方案</b>；
              <b>处置执行权归管理员</b>——系统只检测与建议，不自动隔离 / 封禁 / 清除，由你逐条确认后执行。
              新出现的注入载荷特征会自动 <b>学习进检测库</b>，下次同类变体（混淆绕过）也能识别。
            </p>
          </div>
          {profile.pendingRemedies.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">待管理员确认的处置方案（{profile.pendingRemedies.length} 条）</p>
              {profile.pendingRemedies.slice(0, 6).map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/5 p-2 text-[11px]">
                  <BrainCircuit className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{r.action}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">目标：{r.targetType}/{r.targetId} · {fmtTime(r.at)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => confirmRemedy(r.logId)}>
                      <Wrench className="h-3 w-3" /> 确认执行
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => { popPendingRemedy(r.logId); api.ignoreSecurityLog(r.logId); toast.success('已忽略该方案'); }}>
                      <CheckCircle2 className="h-3 w-3" /> 忽略
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {profile.autoActions.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">最近自动处置记录</p>
              {profile.autoActions.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2 text-[11px]">
                  <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate">{a.action}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">目标：{a.target} · {fmtTime(a.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-1.5 font-medium">
              <Globe className="h-4 w-4 text-primary" /> 威胁情报参考（只读外链）
            </h3>
            <Badge className="bg-muted text-muted-foreground">只读 · 不自动接入</Badge>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            仅供管理员人工查阅外部威胁情报与安全社区；本应用<span className="text-foreground">不自动拉取、不执行</span>任何外部返回内容，避免供应链投毒与自修改代码。点击将在新标签页打开（不携带本站凭据）。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { name: '漏洞平台导航', url: 'https://www.shentoushi.top', desc: 'shentoushi.top · 安全社区/平台索引' },
              { name: '微步在线X', url: 'https://x.threatbook.cn', desc: '威胁情报分析平台' },
              { name: 'FreeBuf', url: 'https://www.freebuf.com', desc: '安全资讯与攻防技术' },
              { name: '安全脉搏', url: 'https://www.secpulse.com', desc: '安全技术与漏洞分享' },
              { name: '先知社区', url: 'https://xz.aliyun.com', desc: '阿里先知安全技术社区' },
              { name: 'T00LS', url: 'https://www.t00ls.net', desc: '低调求发展 · 安全论坛' },
            ].map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/50 hover:bg-primary/5">
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{l.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{l.desc}</p>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-2.5 text-[10px] leading-4 text-muted-foreground/70">
            外链指向第三方站点，内容与本应用无关；查阅时请自行核验来源可信度。如需接入有文档、有鉴权的威胁情报 API（如微步），请按「路径 B」单独评估后实施。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
