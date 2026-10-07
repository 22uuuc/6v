// EXPORTS: GuardBanner（组件文件）——全站防篡改/病毒告警横幅
// 监听安全日志中未处理的篡改/攻击事件，在页面顶部展示红色告警，
// 并展示防篡改守护的运行状态（启动时由 index.tsx 调用 startGuard）。
import { Link } from 'react-router-dom';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { security } from '@/lib/security';
import { guardStats } from '@/lib/guard';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';

export default function GuardBanner() {
  useDataVersion();
  const { user } = useAuth();
  const logs = security.logs();
  const danger = logs.find((l) => l.status === 'flagged' && (l.kind === 'tamper' || l.kind === 'attack'));
  const stats = guardStats();

  if (!danger) {
    // 运行正常：仅在管理页显示轻量状态，避免打扰普通读者
    if (user?.role === 'admin') {
      return (
        <div className="flex items-center justify-center gap-1.5 border-b border-border/60 bg-emerald-950/40 px-4 py-1 text-[11px] text-emerald-300/80">
          <ShieldCheck className="h-3 w-3" />
          防篡改守护运行中 · 上次巡检 {stats.lastScanAt ? new Date(stats.lastScanAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '等待首次巡检'}
          {stats.repaired > 0 && <> · 已自动修复 {stats.repaired} 处篡改</>}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-destructive/40 bg-destructive/15 px-4 py-1.5 text-[11px] text-destructive">
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
      <span>
        系统检测到数据被篡改或恶意注入（{danger.message?.slice(0, 40)}），已触发查杀与隔离
      </span>
      {user?.role === 'admin' ? (
        <Link to="/admin" className="underline underline-offset-2 hover:text-destructive-foreground">
          前往安全中心处理
        </Link>
      ) : (
        <span className="opacity-80">管理员正在处理，数据已受保护</span>
      )}
    </div>
  );
}
