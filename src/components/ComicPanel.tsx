// EXPORTS: ComicPanel（组件文件）
import { useEffect, useRef, useState } from 'react';
import { idbGet } from '@/lib/idb';
import { comicPageSVG } from '@/lib/svg';
import type { IComicPage } from '@/lib/types';

/** 漫画单页：接近视口才取图/渲染分镜，整话长图不再一次性解码导致卡顿 */
export default function ComicPanel({ page, seed }: { page: IComicPage; seed: string }) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  // 视口外不取图、不渲染 SVG（rootMargin 提前 600px 预载，滚动无感）
  useEffect(() => {
    if (near) return;
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // objectURL 卸载时回收，防止连续阅读多话造成内存泄漏
  useEffect(() => {
    if (!near || !page.imageKey) return;
    let alive = true;
    let objectUrl: string | null = null;
    idbGet(page.imageKey).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [near, page.imageKey]);

  if (!near) {
    return (
      <div
        ref={holderRef}
        className="min-h-[240px] animate-pulse rounded-xl border border-border bg-muted/40 shadow-md shadow-black/30"
        aria-hidden="true"
      />
    );
  }

  if (page.imageKey && url) {
    return (
      <div ref={holderRef} className="overflow-hidden rounded-xl border border-border shadow-md shadow-black/30">
        <img src={url} alt="" loading="lazy" decoding="async" className="w-full" />
      </div>
    );
  }
  return (
    <div
      ref={holderRef}
      className="overflow-hidden rounded-xl border border-border shadow-md shadow-black/30"
      dangerouslySetInnerHTML={{ __html: comicPageSVG(page.scene, seed, page.dialogue, page.caption, page.index) }}
    />
  );
}
