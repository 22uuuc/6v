// EXPORTS: SceneArt（组件文件）
import { sceneSVG, posterSVG } from '@/lib/svg';
import { cn } from '@/lib/utils';

export default function SceneArt({
  scene,
  seed,
  variant = 'scene',
  className,
}: {
  scene: string;
  seed: string;
  variant?: 'scene' | 'poster';
  className?: string;
}) {
  const svg = variant === 'poster' ? posterSVG(scene, seed) : sceneSVG(scene, seed);
  return (
    <div className={cn('h-full w-full overflow-hidden', className)} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
