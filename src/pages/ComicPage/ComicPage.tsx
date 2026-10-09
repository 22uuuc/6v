// EXPORTS: ComicPage（组件文件）
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip, fmtCoins } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import ComicPanel from '@/components/ComicPanel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ComicPage() {
  const { bookId = '', chapterId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();

  const book = useMemo(() => api.getBook(bookId), [bookId]);
  const chapters = useMemo(() => (book ? api.comicChapters(bookId) : []), [book, bookId]);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const chapter = index >= 0 ? chapters[index] : null;
  const pages = useMemo(() => (chapter ? api.comicPages(chapter.id) : []), [chapter, chapter?.id]);

  useEffect(() => {
    if (chapter && user) api.saveProgress(user.id, bookId, chapter.id);
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  if (!book || !chapter) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        章节不存在
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => navigate(`/book/${bookId}`)}>返回详情</Button>
        </div>
      </div>
    );
  }

  const unlocked = user ? api.isUnlocked(user.id, book, 'comic', chapter) : chapter.price <= 0;

  const pay = () => {
    if (!user) {
      toast.info('请先登录');
      navigate('/auth');
      return;
    }
    if (user.coins < chapter.price) {
      toast.error('书币不足，请先充值');
      navigate('/profile');
      return;
    }
    api.payComic(user.id, chapter, book);
    toast.success(`已订阅第${chapter.index}话（${chapter.price} 书币）`);
  };

  return (
    <div className="mx-auto max-w-md">
      {/* 顶栏 */}
      <div className="sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/book/${bookId}`)} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">第{chapter.index}话 · {chapter.title}</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={index <= 0}
            onClick={() => navigate(`/comic/${bookId}/${chapters[index - 1].id}`)}
            aria-label="上一话"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={index >= chapters.length - 1}
            onClick={() => navigate(`/comic/${bookId}/${chapters[index + 1].id}`)}
            aria-label="下一话"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {/* 分镜页面（纵向滚动） */}
      <div className="space-y-4 pb-8">
        {pages.map((p) => (
          <ComicPanel key={p.id} page={p} seed={`${book.id}-${p.id}`} />
        ))}
        <p className="pt-2 text-center text-xs text-muted-foreground">
          — 第{chapter.index}话 完 —{index < chapters.length - 1 ? ' 下一话待更新' : ''}
        </p>
      </div>

      {/* 付费拦截 */}
      <Dialog open={!unlocked} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> 本话为付费内容
            </DialogTitle>
            <DialogDescription>
              第{chapter.index}话 · {chapter.title}
              <br />
              价格：{fmtCoins(chapter.price)} 书币
              {user && isVip(user) ? '（VIP 免费）' : '（开通 VIP 可免费阅读）'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => navigate(`/book/${bookId}`)}>返回详情</Button>
            <Button onClick={pay}>订阅本话（{chapter.price} 币）</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
