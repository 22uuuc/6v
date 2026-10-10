// EXPORTS: RankPage（组件文件）
// 排行榜：热读榜 / 新书榜 / 打赏榜 三榜合一，数据来自 api.rankBooks 实时聚合。
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Sparkles, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MEDALS = ['bg-amber-400 text-black', 'bg-slate-300 text-black', 'bg-orange-400 text-black'];
const TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话', game: '游戏' };

export default function RankPage() {
  useDataVersion();
  const navigate = useNavigate();
  const [kind, setKind] = useState<'views' | 'new' | 'tips'>('views');

  const list = useMemo(() => api.rankBooks(kind), [kind]);

  const tabs: { key: 'views' | 'new' | 'tips'; label: string; icon: typeof Flame }[] = [
    { key: 'views', label: '热读榜', icon: Flame },
    { key: 'new', label: '新书榜', icon: Sparkles },
    { key: 'tips', label: '打赏榜', icon: Trophy },
  ];

  return (<div className="page-enter space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="section-title text-gradient-anime font-serif text-xl font-bold">排行榜</h1>
          <p className="text-xs text-muted-foreground">热读 / 新书 / 打赏 · 数据实时统计</p>
        </div>
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as 'views' | 'new' | 'tips')}>
        <TabsList className="w-full">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 gap-1.5">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="space-y-2 pt-3">
            {list.length === 0 ? (
              <EmptyState text="榜单还在蓄力中，作品上架后自动上榜" className="py-12" />
            ) : (
              list.map(({ book, label }, i) => (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="card-anime flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-serif text-sm font-bold shadow ${i < 3 ? MEDALS[i] : 'bg-muted text-muted-foreground/50'}`}>
                    {i + 1}
                  </span>
                  <div className="w-11 shrink-0">
                    <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont}  type={book.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{book.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{book.authorName}</span>
                      <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[book.type]}</Badge>
                      {book.featured && <Badge className="bg-primary text-[10px] text-primary-foreground">编辑推荐</Badge>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-primary">{label}</span>
                </Link>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
