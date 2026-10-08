// EXPORTS: EmptyState（组件文件）
import { BookX } from 'lucide-react';
import { cn } from '@/lib/utils';
import MoyingMascot from '@/components/MoyingMascot';

export default function EmptyState({ text, className, mascot }: { text: string; className?: string; mascot?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      {mascot ? (
        <div className="mascot-bounce">
          <MoyingMascot mood="sleepy" size={84} />
        </div>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BookX className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
