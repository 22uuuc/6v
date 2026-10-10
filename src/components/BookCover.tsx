// EXPORTS: BookCover（组件文件）
// 封面组件：优先渲染本地上传封面（coverType='image' 时从 IndexedDB 读取），否则渲染程序化 SVG 封面。
// 书名字体跟随 book.coverFont（COVER_FONTS 中的字体栈）。
import { useEffect, useMemo, useState } from 'react';
import { coverSVG } from '@/lib/svg';
import { charArtByGenre, charArtUrl, sceneArtUrl } from '@/lib/charArt';
import { cn, coverFontStack, inferCoverStyle } from '@/lib/utils';
import { idbGet } from '@/lib/idb';
import type { CoverFont, CoverStyle } from '@/lib/types';

export default function BookCover({
  seed,
  title,
  author,
  genre,
  style,
  bookId,
  coverType,
  font,
  className,
  type,
}: {
  seed: string;
  title: string;
  author: string;
  genre: string;
  style?: CoverStyle;
  /** 作品 id：coverType='image' 时从 IndexedDB 读取本地上传封面 */
  bookId?: string;
  /** 封面来源：image 走本地封面，缺省走 SVG */
  coverType?: 'svg' | 'image';
  /** 书名字体（COVER_FONTS.value） */
  font?: CoverFont | string;
  className?: string;
  /** 书籍类型：visual→互动 IP 角色位图；comic/anime→题材角色位图；novel/video/game/dialogue→题材场景位图 */
  type?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const useImage = coverType === 'image' && !!bookId;

  useEffect(() => {
    if (!useImage || !bookId) return;
    let alive = true;
    idbGet(`cover:${bookId}`)
      .then((blob) => {
        if (!alive || !blob) return;
        setUrl(URL.createObjectURL(blob));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [useImage, bookId]);

  const fontStack = coverFontStack(font);

  const artSrc = useMemo(() => {
    if (!type || coverType === 'image') return null;
    if (type === 'visual') return charArtUrl(bookId || seed || 'role');
    if (type === 'comic' || type === 'anime') return charArtByGenre(seed, genre);
    if (type === 'novel' || type === 'dialogue' || type === 'video' || type === 'game') return sceneArtUrl(seed, genre);
    return null;
  }, [type, bookId, seed, genre, coverType]);

  if (useImage && url) {
    return (
      <div className={cn('cover-fade-in relative aspect-[5/7] w-full overflow-hidden rounded-lg shadow-md shadow-black/40', className)}>
        <img src={url} alt={title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2.5 text-center">
          <p
            className="text-base font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: fontStack }}
          >
            {title}
          </p>
          <p className="text-[10px] text-white/75">{author}</p>
        </div>
      </div>
    );
  }


  if (artSrc) {
    return (
      <div className={cn('cover-fade-in relative aspect-[5/7] w-full overflow-hidden rounded-lg shadow-md shadow-black/40', className)}>
        <img
          src={artSrc}
          alt={title}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2.5 text-center">
          <p
            className="text-base font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: fontStack }}
          >
            {title}
          </p>
          <p className="text-[10px] text-white/75">{author}</p>
        </div>
        {type === 'visual' && (
          <div className="absolute right-1.5 top-1.5 rounded-full bg-[#f14627]/95 px-2 py-px text-[9px] font-bold text-white ring-1 ring-[#ffd9a0]">互动</div>
        )}
      </div>
    );
  }
  const svg = coverSVG(seed, title, author, genre, {
    style: style ?? inferCoverStyle(genre),
    font: fontStack,
  });
  return (
    <div
      className={cn('aspect-[5/7] w-full overflow-hidden rounded-lg shadow-md shadow-black/40', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
