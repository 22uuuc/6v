// EXPORTS: BookDetailPage（组件文件）
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookMarked, BookmarkCheck, Star, Eye, Lock, Play,
  Gift, MessageSquareText, Images, BookOpenText, MessagesSquare, Gamepad2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip, fmtCoins } from '@/lib/api';
import { heroArtUrl } from '@/lib/charArt';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookCover from '@/components/BookCover';
import CommentSection from '@/components/CommentSection';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TYPE_ICON = { novel: BookOpenText, visual: MessageSquareText, comic: Images, anime: Play, dialogue: MessagesSquare, game: Gamepad2 };
const TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话小说', game: '游戏' };

const TIP_AMOUNTS = [50, 100, 500, 1000];

export default function BookDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();

  const book = api.getBook(id);
  const [tipOpen, setTipOpen] = useState(false);

  useEffect(() => {
    if (book && book.status === 'published') api.addView(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const chapters = useMemo(() => (book?.type === 'novel' || book?.type === 'dialogue' ? api.chaptersOf(id) : []), [id, book?.type]);
  const comicChs = useMemo(() => (book?.type === 'comic' ? api.comicChapters(id) : []), [id, book?.type]);
  const related = useMemo(() => {
    if (!book) return [];
    return api.publishedBooks().filter((b) => b.id !== book.id && (b.type === book.type || b.genre === book.genre)).slice(0, 5);
  }, [book]);

  if (!book || (book.status !== 'published' && !(user && user.role === 'admin'))) {
    return (<div className="page-enter space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 返回
        </Button>
        <EmptyState text="作品不存在或未上架" />
      </div>
    );
  }

  const inShelf = user ? api.inShelf(user.id, book.id) : false;
  const progress = user ? api.getProgress(user.id, book.id) : null;
  const TypeIcon = TYPE_ICON[book.type];

  const startTarget = (() => {
    if (book.type === 'novel' || book.type === 'dialogue') {
      const base = book.type === 'dialogue' ? 'dialogue' : 'read';
      if (progress?.chapterId) return `/${base}/${book.id}/${progress.chapterId}`;
      return chapters.length ? `/${base}/${book.id}/${chapters[0].id}` : null;
    }
    if (book.type === 'visual') return `/visual/${book.id}`;
    if (book.type === 'anime') return `/anime/${book.id}`;
    if (book.type === 'game') return `/game/${book.id}`;
    if (comicChs.length) {
      const last = progress?.chapterId ?? comicChs[0].id;
      return `/comic/${book.id}/${last}`;
    }
    return null;
  })();

  const handleShelf = () => {
    if (!user) {
      toast.info('请先登录');
      navigate('/auth');
      return;
    }
    if (inShelf) {
      api.removeShelf(user.id, book.id);
      toast.success('已移出书架');
    } else {
      api.addShelf(user.id, book.id);
      toast.success('已加入书架');
    }
  };

  const handleTip = async (coins: number) => {
    if (!user) {
      toast.info('请先登录');
      return;
    }
    if (user.coins < coins) {
      toast.error('书币不足，请先充值');
      navigate('/profile');
      return;
    }
    const res = await api.tip(user.id, book, coins);
    if (!res.ok) { toast.error(res.msg ?? '打赏失败'); setTipOpen(false); return; }
    setTipOpen(false);
    toast.success(`已打赏 ${coins} 书币`);
  };

  return (
    <div className="page-enter space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> 返回
      </Button>

      <section className="relative overflow-hidden rounded-2xl border border-border p-5 shadow-lg shadow-primary/10 md:p-6">
        <img
          src={heroArtUrl(`detail-${book.coverSeed}`)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/30" />
        <div className="anime-glow absolute inset-0" />
        <div className="relative flex flex-col gap-5 sm:flex-row">
          <div className="cover-lift relative w-36 shrink-0 self-center overflow-hidden rounded-xl sm:w-44">
          <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont}  type={book.type} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Badge>{TYPE_LABEL[book.type]}</Badge>
            <Badge variant="secondary">{book.genre}</Badge>
            <Badge variant="outline">{book.serial === 'serial' ? '连载中' : '已完结'}</Badge>
            {book.featured && <Badge className="bg-primary text-primary-foreground">编辑推荐</Badge>}
          </div>
          <h1 className="text-gradient-anime font-serif text-2xl font-bold md:text-3xl">{book.title}</h1>
          <p className="text-sm text-muted-foreground">
            {book.authorName} · <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{book.rating > 0 ? book.rating.toFixed(1) : '新书'}</span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{book.views.toLocaleString('zh-CN')} 阅读</span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1"><BookMarked className="h-3.5 w-3.5" />{book.likes} 收藏</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {book.tags.map((t) => (
              <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">#{t}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {startTarget && (
              <Button asChild className="gap-1.5">
                <Link to={startTarget}>
                  <Play className="h-4 w-4" />
                  {book.type === 'game' ? (progress ? '继续游戏' : '开始游戏') : progress ? '继续阅读' : '开始阅读'}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={handleShelf} className="gap-1.5">
              {inShelf ? <BookmarkCheck className="h-4 w-4" /> : <BookMarked className="h-4 w-4" />}
              {inShelf ? '已在书架' : '加入书架'}
            </Button>
            <Button variant="outline" onClick={() => setTipOpen(true)} className="gap-1.5">
              <Gift className="h-4 w-4" /> 打赏
            </Button>
          </div>
          {user && !isVip(user) && (
            <p className="text-xs text-muted-foreground">
              开通 <Link to="/profile" className="text-primary hover:underline">VIP</Link> 可免费阅读全部付费内容
            </p>
          )}
          </div>
        </div>
      </section>

      <Card className="card-anime">
        <CardContent className="p-4">
          <h2 className="section-title mb-2 font-medium">内容简介</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{book.description}</p>
        </CardContent>
      </Card>

      {(book.type === 'novel' || book.type === 'dialogue') && (
        <section>
          <h2 className="section-title mb-3 font-medium">{book.type === 'dialogue' ? '对话章节' : '章节'}（{chapters.length}）</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {chapters.map((ch) => (
              <Link
                key={ch.id}
                to={`/${book.type === 'dialogue' ? 'dialogue' : 'read'}/${book.id}/${ch.id}`}
                className="card-anime flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/60"
              >
                <span className="truncate text-sm">第{ch.index}章 · {ch.title}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {ch.price > 0 ? (
                    <>{ch.price > 0 && <Lock className="h-3 w-3" />}{ch.price} 币</>
                  ) : (
                    '免费'
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {book.type === 'comic' && (
        <section>
          <h2 className="section-title mb-3 font-medium">漫画话数（{comicChs.length}）</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {comicChs.map((ch) => (
              <Link
                key={ch.id}
                to={`/comic/${book.id}/${ch.id}`}
                className="card-anime flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/60"
              >
                <span className="truncate text-sm">第{ch.index}话 · {ch.title}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {ch.price > 0 ? (<>{ch.price} 币</>) : '免费'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {book.type === 'visual' && (
        <Card className="card-anime">
          <CardContent className="p-4">
            <h2 className="section-title mb-2 flex items-center gap-2 font-medium">
              <TypeIcon className="h-4 w-4" /> 互动说明
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              这部作品是画面互动小说：以插画场景推进剧情，你的每次选择都会走向不同分支，可以解锁多个结局。
            </p>
            {book.chapterPrice > 0 && (
              <p className="mt-2 text-sm">
                全本解锁：<span className="font-medium text-primary">{fmtCoins(book.chapterPrice)} 书币</span>
                {user && isVip(user) && <span className="ml-2 text-xs text-muted-foreground">（VIP 免费）</span>}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {book.type === 'game' && (
        <Card className="card-anime">
          <CardContent className="p-4">
            <h2 className="section-title mb-2 flex items-center gap-2 font-medium">
              <TypeIcon className="h-4 w-4" /> 游戏试玩
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              这部作品是上架游戏：在游戏页即可直接开玩（{book.gameKind === 'memory' ? '翻牌记忆配对' : '内置试玩模板'}），
              支持反复挑战刷新最佳成绩，喜欢就给作者打个赏吧。
            </p>
          </CardContent>
        </Card>
      )}

      <CommentSection bookId={book.id} bookTitle={book.title} />

      {related.length > 0 && (
        <section>
          <h2 className="section-title mb-3 font-medium">猜你喜欢</h2>
          <div className="grid grid-cols-5 gap-3 sm:gap-4">
            {related.map((b) => (
              <Link key={b.id} to={`/book/${b.id}`} className="cover-lift relative block overflow-hidden rounded-xl">
                <BookCover seed={b.coverSeed} title={b.title} author={b.authorName} genre={b.genre} style={b.coverStyle} bookId={b.id} coverType={b.coverType} font={b.coverFont}  type={b.type} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <Dialog open={tipOpen} onOpenChange={setTipOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>打赏《{book.title}》</DialogTitle>
            <DialogDescription>
              当前书币：{user ? fmtCoins(user.coins) : '未登录'}。打赏全额归创作者。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {TIP_AMOUNTS.map((a) => (
              <Button key={a} variant="outline" onClick={() => handleTip(a)}>
                {a}
              </Button>
            ))}
          </div>
          <DialogFooter className="text-xs text-muted-foreground">
            打赏会记录在收益中心，创作者可在后台查看
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
