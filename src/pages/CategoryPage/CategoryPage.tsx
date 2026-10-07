// EXPORTS: CategoryPage（组件文件）
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import BookCard from '@/components/BookCard';
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
  const [genre, setGenre] = useState<BookGenre | 'all'>(qGenre && (GENRES as readonly string[]).includes(qGenre) ? (qGenre as BookGenre) : 'all');
  const [sort, setSort] = useState<SortKey>('hot');
  const [sub, setSub] = useState<'manga' | 'anime'>('manga');
  useDataVersion();

  const effectiveType = type === 'comic' ? (sub === 'anime' ? 'anime' : 'comic') : type === 'all' ? undefined : (type as BookType);

  const books = useMemo(() => {
    const list = api.publishedBooks(effectiveType, genre === 'all' ? undefined : genre);
    if (sort === 'new') return [...list].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating);
    return [...list].sort((a, b) => b.views - a.views);
  }, [effectiveType, genre, sort]);

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
