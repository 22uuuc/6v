// EXPORTS: EmptyState（全站空状态组件 · 墨影书灵 IP 触点）
// mood 表情语义：sleepy 空空如也在打盹（默认）/ reading 等你来读 / happy 一切安好
import { cn } from '@/lib/utils';
import MoyingMascot from '@/components/MoyingMascot';

export default function EmptyState({
  text,
  className,
  mood = 'sleepy',
}: {
  text: string;
  className?: string;
  mood?: 'reading' | 'happy' | 'sleepy';
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="mascot-bounce drop-shadow-[0_0_14px_rgba(168,130,255,0.35)]">
        <MoyingMascot mood={mood} size={84} art />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
