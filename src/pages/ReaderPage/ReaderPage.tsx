// EXPORTS: ReaderPage（组件文件）
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, List, Lock, Minus, Plus, ChevronLeft, ChevronRight, SunMoon } from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip, fmtCoins } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** 阅读主题：墨夜（默认深色）/ 纸感（护眼米纸）/ 深夜（纯黑低对比） */
type ReaderTheme = 'ink' | 'paper' | 'night';
const THEME_LABEL: Record<ReaderTheme, string> = { ink: '墨夜', paper: '纸感', night: '深夜' };

export default function ReaderPage() {
  const { bookId = '', chapterId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();
  const [fontSize, setFontSize] = useState(19);
  const [theme, setTheme] = useState<ReaderTheme>('ink');

  const book = api.getBook(bookId);
  const chapters = useMemo(() => (book ? api.chaptersOf(bookId) : []), [book, bookId]);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const chapter = index >= 0 ? chapters[index] : null;

  useEffect(() => {
    if (chapter && user) {
      api.saveProgress(user.id, bookId, chapter.id);
      api.markReadTask(user.id); // 今日阅读任务（每天一次）
    }
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

  const paras = chapter.content.split('\n\n');
  const progress = chapters.length > 0 ? Math.min(100, Math.round(((index + 1) / chapters.length) * 100)) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      {/* 顶栏 */}
      <div className="sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/book/${bookId}`)} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">第{chapter.index}章 · {chapter.title}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setFontSize((s) => Math.max(16, s - 1))} aria-label="减小字号">
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setFontSize((s) => Math.min(24, s + 1))} aria-label="增大字号">
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs text-muted-foreground"
          onClick={() => setTheme((t) => (t === 'ink' ? 'paper' : t === 'paper' ? 'night' : 'ink'))}
          aria-label="切换阅读主题"
        >
          <SunMoon className="h-4 w-4" />
          {THEME_LABEL[theme]}
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="目录">
              <List className="h-4.5 w-4.5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>目录 · {book.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1 overflow-y-auto">
              {chapters.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/read/${bookId}/${c.id}`)}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    c.id === chapter.id ? 'bg-muted font-medium text-primary' : 'text-foreground'
                  }`}
                >
                  第{i + 1}章 · {c.title}
                  {c.price > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{c.price}币</span>}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* 章节进度条 */}
      <div className="-mx-4 h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary via-[hsl(45_92%_62%)] to-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 正文 */}
      <article
        className={`min-h-[60vh] px-2 pb-10 transition-colors duration-300 ${
          theme === 'paper'
            ? 'reading-article mt-4 rounded-2xl border border-[hsl(40_30%_72%)] bg-[#f5ecd9] p-5 text-[#33302a] shadow-[0_12px_30px_-14px_hsl(0_0%_0%/0.5)] sm:p-7'
            : theme === 'night'
              ? 'reading-article mt-4 rounded-2xl bg-black/50 p-5 text-foreground/80 sm:p-7'
              : 'reading-article text-foreground/90'
        }`}
        style={{ fontSize: `${fontSize}px` }}
      >
        <h1
          className={`mb-1 font-serif text-xl font-bold ${
            theme === 'paper' ? 'text-[#2c2720]' : theme === 'night' ? 'text-foreground' : ''
          }`}
        >
          {chapter.title}
        </h1>
        <p className={`mb-6 text-xs ${theme === 'paper' ? 'text-[#8a7c66]' : 'text-muted-foreground'}`}>
          第{chapter.index}章 · {book.title} · {book.authorName}
        </p>
        {paras.map((p, i) => (
          <p key={i} className="mb-4 text-justify">
            {p}
          </p>
        ))}
      </article>

      {/* 翻页 */}
      <div className="flex items-center justify-between gap-2 border-t border-border py-4">
        <Button
          variant="outline"
          size="sm"
          disabled={index <= 0}
          onClick={() => navigate(`/read/${bookId}/${chapters[index - 1].id}`)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> 上一章
        </Button>
        <span className="text-xs text-muted-foreground">{index + 1} / {chapters.length}</span>
        <Button
          size="sm"
          disabled={index >= chapters.length - 1}
          onClick={() => navigate(`/read/${bookId}/${chapters[index + 1].id}`)}
        >
          下一章 <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* 付费拦截 */}
      <Dialog open={!unlocked} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> 本章为付费章节
            </DialogTitle>
            <DialogDescription>
              第{chapter.index}章 · {chapter.title}
              <br />
              价格：{fmtCoins(chapter.price)} 书币
              {user && isVip(user) ? '（VIP 免费）' : '（开通 VIP 可免费阅读）'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => navigate(`/book/${bookId}`)}>返回详情</Button>
            <Button onClick={pay}>订阅本章（{chapter.price} 币）</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
