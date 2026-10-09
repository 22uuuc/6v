// EXPORTS: SearchPage（组件文件）
import { useMemo, useState } from 'react';
import { Search, SearchX } from 'lucide-react';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import BookCard from '@/components/BookCard';
import EmptyState from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SearchPage() {
  const [kw, setKw] = useState('');
  const [query, setQuery] = useState('');
  useDataVersion();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return api
      .publishedBooks()
      .filter((b) =>
        [b.title, b.authorName, b.genre, ...b.tags].some((s) => s.toLowerCase().includes(q)),
      );
  }, [query]);

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(kw);
        }}
      >
        <Input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜书名、作者、标签，如：馄饨 / 知了 / 悬疑"
          className="flex-1"
        />
        <Button type="submit" className="gap-1.5">
          <Search className="h-4 w-4" /> 搜索
        </Button>
      </form>

      {query === '' ? (
        <EmptyState text="输入关键词，找到你想读的那本书" />
      ) : results.length === 0 ? (
        <div className="py-16 text-center">
          <SearchX className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">没有找到与「{query}」相关的作品</p>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">找到 {results.length} 部相关作品</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {results.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
