// EXPORTS: GuardBanner（组件文件）——全站守护状态条
// 顶部不再展示红色告警横幅（安全告警仅保留在安全中心，由管理员查看与处置）；
// 仅管理员可见绿色守护运行状态，普通用户界面不显示任何安全信息。
import { ShieldCheck } from 'lucide-react';
import { guardStats } from '@/lib/guard';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';

export default function GuardBanner() {
  useDataVersion();
  const { user } = useAuth();
  const stats = guardStats();

  // 仅管理员可见轻量守护状态；普通用户不展示安全信息
  if (user?.role !== 'admin') return null;

  return (
    <div className="flex items-center justify-center gap-1.5 border-b border-border/60 bg-emerald-950/40 px-4 py-1 text-[11px] text-emerald-300/80">
      <ShieldCheck className="h-3 w-3" />
      防篡改守护运行中 · 上次巡检 {stats.lastScanAt ? new Date(stats.lastScanAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '等待首次巡检'}
      {stats.repaired > 0 && <> · 已自动修复 {stats.repaired} 处篡改</>}
    </div>
  );
}
