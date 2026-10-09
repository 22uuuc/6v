// EXPORTS: CategoryPage（组件文件）
import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import BookCard from '@/components/BookCard';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BookGenre, BookType } from '@/lib/types';
import { GENRES } from '@/lib/types';

const TYPE_META: Record<string, { label: string; desc: string }> = {
  all: { label: '全部作品', desc: '小说、互动、漫画、动漫，一座城都在这' },
  novel: { label: '普通小说', desc: '沉浸式文字阅读，章节连载' },
  visual: { label: '画面互动小说', desc: '插画场景 + 剧情分支，选择决定结局' },
  comic: { label: '漫画', desc: '分镜画面，一话一话追下去' },
  anime: { label: '动漫视频', desc: '动画番剧，管理员独家上传' },
};

type SortKey = 'hot' | 'new' | 'rating';

export default function CategoryPage() {
  const { type = 'all' } = useParams();
  const [params] = useSearchParams();
  const qGenre = params.get('genre');
  const qSerial = params.get('serial');
  const [genre, setGenre] = useState<BookGenre | 'all'>(qGenre && (GENRES as readonly string[]).includes(qGenre) ? (qGenre as BookGenre) : 'all');
  const [sort, setSort] = useState<SortKey>('hot');
  const [sub, setSub] = useState<'manga' | 'anime'>('manga');
  useDataVersion();

  const effectiveType = type === 'comic' ? (sub === 'anime' ? 'anime' : 'comic') : type === 'all' ? undefined : (type as BookType);

  const books = useMemo(() => {
    let list = api.publishedBooks(effectiveType, genre === 'all' ? undefined : genre);
    // 完本过滤（首页「完本精品」快捷入口经 ?serial=finished 进入）
    if (qSerial === 'finished') list = list.filter((b) => b.serial === 'finished');
    if (sort === 'new') return [...list].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating);
    return [...list].sort((a, b) => b.views - a.views);
  }, [effectiveType, genre, sort, qSerial]);

  const meta = type === 'comic' && sub === 'anime' ? TYPE_META.anime : TYPE_META[type] ?? TYPE_META.all;
  const genres = useMemo(() => {
    const all = api.publishedBooks(effectiveType);
    return Array.from(new Set(all.map((b) => b.genre)));
  }, [effectiveType]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-bold">{meta.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
        {qSerial === 'finished' && (
          <Button asChild size="sm" className="mt-2 gap-1.5">
            <Link to="/category/all">
              只看完本 <span className="text-xs opacity-70">✕ 清除</span>
            </Link>
          </Button>
        )}
      </div>

      {type === 'comic' && (
        <div className="flex gap-2">
          <Button size="sm" variant={sub === 'manga' ? 'default' : 'outline'} onClick={() => setSub('manga')}>
            漫画
          </Button>
          <Button size="sm" variant={sub === 'anime' ? 'default' : 'outline'} onClick={() => setSub('anime')}>
            动漫视频
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={genre === 'all' ? 'default' : 'outline'}
          onClick={() => setGenre('all')}
        >
          全部
        </Button>
        {genres.map((g) => (
          <Button key={g} size="sm" variant={genre === g ? 'default' : 'outline'} onClick={() => setGenre(g)}>
            {g}
          </Button>
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

      {books.length === 0 ? (
        <EmptyState text={effectiveType === 'anime' ? '动漫视频区还没有内容，仅管理员可上传' : '这个分类还没有作品，去创作中心上传第一本吧'} />
      ) : effectiveType === 'comic' || effectiveType === 'anime' ? (
        /* 漫画 / 动漫：番剧墙海报流（大封面 + 渐变信息条 + 角标） */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => {
            const isAnime = effectiveType === 'anime' || (book.type === 'anime');
            const to = isAnime
              ? `/anime/${book.id}`
              : book.type === 'comic'
                ? `/comic/${book.id}`
                : `/book/${book.id}`;
            return (
              <Link
                key={book.id}
                to={to}
                className="group relative block overflow-hidden rounded-2xl border border-border shadow-[0_14px_30px_-20px_hsl(0_0%_0%/0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_-22px_hsl(0_0%_0%/0.6)]"
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
                  />
                </div>
                {/* 渐变信息条：标题 + 标签 */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-12">
                  <p className="truncate text-sm font-bold text-white drop-shadow">{book.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/80">
                    <span className="rounded bg-white/20 px-1.5 py-0.5 backdrop-blur">{book.genre}</span>
                    <span>{isAnime ? '动漫' : '漫画'}</span>
                    <span className="ml-auto">{book.views.toLocaleString()} 追</span>
                  </p>
                </div>
                {/* 类型角标 */}
                <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  {isAnime ? '▶ 动漫' : '漫画'}
                </span>
                {book.rating >= 4.5 && (
                  <span className="absolute right-2 top-2 rounded-md bg-[hsl(333_92%_66%)]/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
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
