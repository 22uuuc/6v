// EXPORTS: ShelfPage（组件文件）
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History, BookMarked, ArrowRight, LogIn, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IPrivacy } from '@/lib/types';

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

export default function ShelfPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDataVersion();

  const shelf = useMemo(() => (user ? api.shelfOf(user.id) : []), [user]);
  const recent = useMemo(() => (user ? api.recentReads(user.id) : []), [user]);
  const privacy: IPrivacy = { hideBalance: false, hideRecent: false, hideShelf: false, hideRecords: false, stealth: false, ...(user?.privacy ?? {}) };

  if (!user) {
    return (
      <div className="py-20">
        <EmptyState text="登录后，你的书架和阅读记录会出现在这里" />
        <div className="flex justify-center">
          <Button onClick={() => navigate('/auth')} className="gap-1.5">
            <LogIn className="h-4 w-4" /> 去登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-gradient-anime font-serif text-2xl font-bold">我的书架</h1>
      {privacy.hideShelf && (
        <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" /> 书架已设为隐私（对外不可见），你仍可正常阅读与管理
        </p>
      )}
      <Tabs defaultValue="recent">
        <TabsList className="rounded-full border border-border/60 bg-muted/50 p-1">
          <TabsTrigger value="recent" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> 最近阅读
          </TabsTrigger>
          <TabsTrigger value="shelf" className="gap-1.5">
            <BookMarked className="h-3.5 w-3.5" /> 我的收藏（{shelf.length}）
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="pt-3">
          {privacy.hideRecent ? (
            <EmptyState text="最近阅读已设为隐私，对外不可见" />
          ) : recent.length === 0 ? (
            <EmptyState text="还没有阅读记录，去书城逛逛吧" />
          ) : (
            // 最近阅读：B站式横滑封面大卡（竖版书封 + 底部渐变信息条 + 继续角标）
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3">
              {recent.map((r) => {
                const prog = api.getProgress(user.id, r.book.id);
                const to =
                  r.book.type === 'novel'
                    ? `/read/${r.book.id}/${prog?.chapterId ?? ''}`
                    : r.book.type === 'visual'
                      ? `/visual/${r.book.id}`
                      : `/comic/${r.book.id}/${prog?.chapterId ?? ''}`;
                return (
                  <Link key={r.book.id} to={to} className="group w-40 shrink-0 snap-start">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border shadow-[0_12px_28px_-18px_hsl(0_0%_0%/0.55)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_34px_-18px_hsl(0_0%_0%/0.6)]">
                      <BookCover seed={r.book.coverSeed} title={r.book.title} author={r.book.authorName} genre={r.book.genre} style={r.book.coverStyle} bookId={r.book.id} coverType={r.book.coverType} font={r.book.coverFont}  type={r.book.type} />
                      {/* 底部渐变信息条 */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-2.5 pb-3 pt-8">
                        <p className="truncate text-xs font-medium text-white">{r.book.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-white/75">
                          {r.chapterTitle ? `读到：${r.chapterTitle}` : r.book.type === 'visual' ? '互动剧情中' : '已加入阅读'}
                        </p>
                      </div>
                      {/* 继续角标 */}
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[hsl(9_88%_52%)] to-[hsl(12_92%_60%)] px-2 py-0.5 text-[10px] font-medium text-white shadow">
                        继续 <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                      <span className="absolute bottom-1.5 right-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] text-white/85 backdrop-blur">
                        {fmtTime(r.updatedAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shelf" className="pt-3">
          {shelf.length === 0 ? (
            <EmptyState text="书架还空着，看到喜欢的点『加入书架』" mood="reading" />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
              {shelf.map((book) => {
                const updated = api.bookHasUpdate(user.id, book);
                return (
                  <Link key={book.id} to={`/book/${book.id}`} className="group relative block">
                    <div className="relative">
                      <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont}  type={book.type} />
                      {updated && (
                        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                          更新
                        </span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium">{book.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{book.authorName}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
