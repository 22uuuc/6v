// EXPORTS: BookCard（组件文件）
import { Link } from 'react-router-dom';
import { Star, Eye } from 'lucide-react';
import type { IBook } from '@/lib/types';
import BookCover from '@/components/BookCover';
import { Badge } from '@/components/ui/badge';

const TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话', game: '游戏' };

export default function BookCard({ book }: { book: IBook }) {
  return (
    <Link to={`/book/${book.id}`} className="group block">
      <div className="cover-lift relative">
        <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont} charArt={book.type === 'visual'} />
        <Badge className="absolute left-2 top-2 bg-black/55 text-[10px] text-foreground backdrop-blur">
          {TYPE_LABEL[book.type]}
        </Badge>
        {book.serial === 'serial' ? (
          <Badge variant="outline" className="absolute bottom-2 right-2 bg-black/45 text-[10px] text-primary">
            连载
          </Badge>
        ) : (
          <Badge variant="outline" className="absolute bottom-2 right-2 bg-black/45 text-[10px] text-muted-foreground">
            完结
          </Badge>
        )}
      </div>
      <h3 className="mt-2 truncate text-sm font-medium text-foreground group-hover:text-primary">
        {book.title}
      </h3>
      <p className="mt-1 flex items-center gap-1 text-[10px]">
        <span className="chip-grad chip-gold rounded-full px-1.5 py-0.5 font-medium">{book.subcategory || book.genre}</span>
        <span className="text-muted-foreground/60">{TYPE_LABEL[book.type]}</span>
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate">{book.authorName}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          <Star className="h-3 w-3 fill-primary text-primary" />
          {book.rating > 0 ? book.rating.toFixed(1) : '新'}
        </span>
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
        <Eye className="h-3 w-3" />
        {book.views.toLocaleString('zh-CN')}
      </p>
    </Link>
  );
}
