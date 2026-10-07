// EXPORTS: ComicPanel（组件文件）
import { useEffect, useState } from 'react';
import { idbGet } from '@/lib/idb';
import { comicPageSVG } from '@/lib/svg';
import type { IComicPage } from '@/lib/types';

/** 漫画单页：优先显示创作者上传的图片，否则渲染程序化分镜 */
export default function ComicPanel({ page, seed }: { page: IComicPage; seed: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    idbGet(page.imageKey).then((blob) => {
      if (!alive || !blob) return;
      setUrl(URL.createObjectURL(blob));
    });
    return () => {
      alive = false;
    };
  }, [page.imageKey]);

  if (page.imageKey && url) {
    return (
      <div className="overflow-hidden rounded-xl border border-border shadow-md shadow-black/30">
        <img src={url} alt="" className="w-full" />
      </div>
    );
  }
  return (
    <div
      className="overflow-hidden rounded-xl border border-border shadow-md shadow-black/30"
      dangerouslySetInnerHTML={{ __html: comicPageSVG(page.scene, seed, page.dialogue, page.caption, page.index) }}
    />
  );
}
