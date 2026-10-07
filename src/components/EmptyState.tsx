// EXPORTS: EmptyState（组件文件）
import { BookX } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmptyState({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <BookX className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
