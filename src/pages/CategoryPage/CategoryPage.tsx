// EXPORTS: CategoryPage（组件文件）
// 书城分类页：五大频道（小说/漫画/动漫/视频/游戏）→ 频道内小类（subcategory）两级筛选
import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { heroArtUrl } from '@/lib/charArt';
import { useDataVersion } from '@/hooks/use-data';
import BookCard from '@/components/BookCard';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BookType } from '@/lib/types';
import { CHANNELS, SUBCATEGORIES } from '@/lib/types';

type SortKey = 'hot' | 'new' | 'rating';

/** 小类筛选胶囊色组（与首页 HOT_GENRES 同体系，循环分配） */
const CHIP_CYCLE = ['chip-violet', 'chip-pink', 'chip-teal', 'chip-blue', 'chip-gold'];

export default function CategoryPage() {
  const { type = 'all' } = useParams();
  const [params] = useSearchParams();
  const qGenre = params.get('genre');
  const qSerial = params.get('serial');
  const [sub, setSub] = useState<string>(qGenre ?? 'all');
  const [sort, setSort] = useState<SortKey>('hot');
  useDataVersion();

  const channel = type === 'all' ? null : (CHANNELS.find((c) => c.key === type) ?? null);
  const types = channel ? (channel.types as BookType[]) : undefined;
  const subs = channel ? (SUBCATEGORIES[channel.key] ?? []) : [];


  const books = useMemo(() => {
    const subList = channel ? (SUBCATEGORIES[channel.key] ?? []) : [];
    let list = api.publishedBooks(types);
    if (sub !== 'all' && subList.includes(sub)) list = list.filter((b) => b.subcategory === sub);
    if (qSerial === 'finished') list = list.filter((b) => b.serial === 'finished');
    if (sort === 'new') return [...list].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating);
    return [...list].sort((a, b) => b.views - a.views);
  }, [types, sub, sort, qSerial, channel]);

  const label = channel ? channel.label : '全部作品';
  const desc = channel ? channel.desc : '小说、漫画、动漫、视频、游戏，一座城都在这';

  const isWall = !!channel && (channel.key === 'comic' || channel.key === 'anime');

  /** 各小类作品计数（静态表 + 实时库存） */
  const subCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const all = api.publishedBooks(types);
    const subList = channel ? (SUBCATEGORIES[channel.key] ?? []) : [];
    for (const s of subList) map[s] = all.filter((b) => b.subcategory === s).length;
    return map;
  }, [types, channel]);

  return (
    <div className="page-enter space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border p-5 shadow-lg shadow-primary/10 md:p-6">
        <img
          src={heroArtUrl(`cat-${type || 'all'}`)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/25" />
        <div className="anime-glow absolute inset-0" />
        <div className="relative">
          <h1 className="section-title text-gradient-anime font-serif text-2xl font-bold">{label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          {qSerial === 'finished' && (
            <Button asChild size="sm" className="btn-anime mt-2 gap-1.5">
              <Link to="/category/all">
                只看完本 <span className="text-xs opacity-70">✕ 清除</span>
              </Link>
            </Button>
          )}
          </div>
      </div>

      {subs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSub('all')}
            className={`chip-grad chip-gold rounded-full px-3.5 py-1.5 text-xs font-medium ${sub === 'all' ? 'ring-2 ring-primary/60' : ''}`}
          >
            全部
          </button>
          {subs.map((s, gi) => (
            <button
              key={s}
              type="button"
              onClick={() => setSub(s)}
              className={`chip-grad ${CHIP_CYCLE[gi % CHIP_CYCLE.length]} rounded-full px-3.5 py-1.5 text-xs font-medium ${sub === s ? 'ring-2 ring-primary/60' : ''}`}
            >
              {s}
              {subCounts[s] > 0 && <span className="ml-1 text-[10px] opacity-60">{subCounts[s]}</span>}
            </button>
          ))}
          <div className="ml-auto w-32">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">按热度</SelectItem>
                <SelectItem value="new">按最新</SelectItem>
                <SelectItem value="rating">按评分</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {books.length === 0 ? (
        <EmptyState text={channel?.key === 'anime' ? '动漫区还没有内容，仅管理员可上传' : '这个分类还没有作品，去创作中心上传第一本吧'} />
      ) : isWall ? (
        /* 漫画 / 动漫：番剧墙海报流（大封面 + 渐变信息条 + 角标） */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => {
            const isAnime = book.type === 'anime';
            const to = isAnime ? `/anime/${book.id}` : book.type === 'comic' ? `/comic/${book.id}` : `/book/${book.id}`;
            return (
              <Link
                key={book.id}
                to={to}
                className="card-anime group relative block overflow-hidden rounded-2xl border border-border shadow-[0_14px_30px_-20px_hsl(0_0%_0%/0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_-22px_hsl(0_0%_0%/0.6)]"
              >
                <div className={isAnime ? 'aspect-video w-full' : 'aspect-[3/4] w-full'}>
                  <BookCover
                    seed={book.coverSeed}
                    title={book.title}
                    author={book.authorName}
                    genre={book.genre}
                    style={book.coverStyle}
                    bookId={book.id}
                    coverType={book.coverType}
                    font={book.coverFont}
                   type={book.type} />
                </div>
                {/* 渐变信息条：标题 + 小类标签 */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-12">
                  <p className="truncate text-sm font-bold text-white drop-shadow">{book.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/80">
                    <span className="rounded bg-white/20 px-1.5 py-0.5 backdrop-blur">{book.subcategory || book.genre}</span>
                    <span>{isAnime ? '动漫' : '漫画'}</span>
                    <span className="ml-auto">{book.views.toLocaleString()} 追</span>
                  </p>
                </div>
                {/* 类型角标 */}
                <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  {isAnime ? '▶ 动漫' : '漫画'}
                </span>
                {book.rating >= 4.5 && (
                  <span className="absolute right-2 top-2 rounded-md bg-[hsl(12_92%_60%)]/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    {book.rating.toFixed(1)} 分
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4 lg:grid-cols-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}