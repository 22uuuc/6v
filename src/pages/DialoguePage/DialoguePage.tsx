// EXPORTS: DialoguePage（组件文件）
// 对话小说阅读器：聊天气泡流推进剧情，锁定/付费逻辑与文字阅读器一致（服务端化后同源校验）
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api, fmtCoins } from '@/lib/api';
import { parseDialogue } from '@/lib/dialogue';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import MoyingMascot from '@/components/MoyingMascot';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DialoguePage() {
  const { bookId = '', chapterId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();

  const book = useMemo(() => api.getBook(bookId), [bookId]);
  const chapters = useMemo(() => (book ? api.chaptersOf(bookId) : []), [book, bookId]);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const chapter = index >= 0 ? chapters[index] : null;
  const lines = useMemo(() => (chapter ? parseDialogue(chapter.content) : []), [chapter]);

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

  const unlocked = user ? api.isUnlocked(user.id, book, 'chapter', chapter) : chapter.price <= 0;
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
    api.payChapter(user.id, chapter);
    toast.success(`已订阅第${chapter.index}章（${chapter.price} 书币）`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* 顶栏 */}
      <div className="sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/book/${bookId}`)} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">第{chapter.index}章 · {chapter.title}</p>
        </div>
        <MoyingMascot mood="reading" size={30} />
      </div>

      {/* 聊天气泡流 */}
      <div
        className="rounded-2xl border border-border p-4 sm:p-6"
        style={{
          background:
            'linear-gradient(160deg, hsl(var(--primary)/0.06), transparent 40%), linear-gradient(20deg, hsl(333 92% 66% / 0.05), transparent 55%)',
        }}
      >
        <div className="space-y-4">
          {lines.map((l, i) => {
            const right = l.side === 'R';
            return (
              <div key={i} className={`anim-fade-up flex items-end gap-2 ${right ? 'flex-row-reverse' : ''}`} style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${
                    right ? 'bg-gradient-to-br from-[hsl(275_84%_62%)] to-[hsl(333_92%_66%)]' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                  }`}
                >
                  {l.speaker.slice(0, 1)}
                </span>
                <div className={`max-w-[78%] ${right ? 'text-right' : ''}`}>
                  <p className="mb-0.5 text-[10px] text-muted-foreground">{l.speaker}</p>
                  <p
                    className={`inline-block whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                      right
                        ? 'rounded-br-sm bg-gradient-to-br from-[hsl(275_84%_62%)] to-[hsl(333_92%_66%)] text-white'
                        : 'rounded-bl-sm border border-[hsl(333_92%_66%/0.22)] bg-gradient-to-br from-card to-[hsl(275_84%_62%/0.05)]'
                    }`}
                  >
                    {l.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 上/下章导航 */}
      <div className="mt-5 flex items-center justify-between gap-3 pb-8">
        <Button
          variant="outline"
          size="sm"
          disabled={index <= 0}
          onClick={() => navigate(`/dialogue/${bookId}/${chapters[index - 1].id}`)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> 上一章
        </Button>
        <span className="text-xs text-muted-foreground">{index + 1} / {chapters.length}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={index >= chapters.length - 1}
          onClick={() => navigate(`/dialogue/${bookId}/${chapters[index + 1].id}`)}
          className="gap-1"
        >
          下一章 <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 未解锁遮罩（与阅读器同款交互） */}
      <Dialog open={!unlocked} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> 本章需订阅后阅读
            </DialogTitle>
            <DialogDescription>
              《{book.title}》第{chapter.index}章 · {chapter.title}，订阅后可随时回看。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full gap-1.5" onClick={pay}>
              <Lock className="h-4 w-4" /> {fmtCoins(chapter.price)} 书币订阅本章
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate(`/book/${bookId}`)}>
              返回详情
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
