// EXPORTS: ReaderPage（组件文件）
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, List, Lock, Minus, Plus, ChevronLeft, ChevronRight, SunMoon, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip, fmtCoins } from '@/lib/api';
import { fontStack } from '@/lib/platform-style';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import MoyingMascot from '@/components/MoyingMascot';
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
  // 个性化偏好：阅读主题/字号/行距/字体（个人设置覆盖平台默认）
  const prefs = useMemo(() => (user ? api.getPrefs(user.id) : null), [user?.id]);
  const [fontSize, setFontSize] = useState(prefs?.fontSize ?? 19);
  // 行距由个性化设置提供（ProfilePage），阅读页只读应用
  const lineHeight = prefs?.lineHeight ?? 1.9;
  const [theme, setTheme] = useState<ReaderTheme>((prefs?.readerTheme as ReaderTheme) ?? 'ink');
  // 沉浸阅读：顶栏/底栏淡出，点正文呼出
  const [immersive, setImmersive] = useState(false);
  // 阅读模式：连续滚动 / 分页翻读（B站漫画式）
  const [mode, setMode] = useState<'scroll' | 'page'>('scroll');
  const [pageIdx, setPageIdx] = useState(0);
  const PAGE_SIZE = 3;

  const switchMode = (m: 'scroll' | 'page') => {
    setMode(m);
    setPageIdx(0);
    window.scrollTo(0, 0);
  };

  // 保存偏好到个人设置（阅读主题/字号），换设备/浏览器后通过个人资料恢复
  // 跳过首挂载：初始值即来自已存偏好，避免每次进入阅读页都写一次盘
  const prefsMounted = useRef(false);
  useEffect(() => {
    if (!prefsMounted.current) {
      prefsMounted.current = true;
      return;
    }
    if (!user) return;
    api.setPrefs(user.id, { fontSize, lineHeight, readerTheme: theme });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, theme]);

  const book = useMemo(() => api.getBook(bookId), [bookId]);
  const chapters = useMemo(() => (book ? api.chaptersOf(bookId) : []), [book, bookId]);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const chapter = index >= 0 ? chapters[index] : null;
  // 长章节按空行切段：仅章节内容变化时重算，字号/行距调整不再重复切分
  const paras = useMemo(() => (chapter ? chapter.content.split('\n\n') : []), [chapter?.content]);

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

  const progress = chapters.length > 0 ? Math.min(100, Math.round(((index + 1) / chapters.length) * 100)) : 0;
  const pageCount = Math.max(1, Math.ceil(paras.length / PAGE_SIZE));
  const pageParas = mode === 'page' ? paras.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE) : paras;

  // 沉浸阅读：点击正文空白处呼出/收起顶栏（选中文字时不触发）
  const tapToggleBars = () => {
    if (!immersive) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    setImmersive((v) => !v);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* 顶栏（沉浸阅读时淡出，点正文呼出） */}
      <div
        className={`sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur-sm transition-all duration-300 ${
          immersive ? 'pointer-events-none -translate-y-3 opacity-0' : ''
        }`}
      >
        <Button variant="ghost" size="icon" onClick={() => navigate(`/book/${bookId}`)} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">第{chapter.index}章 · {chapter.title}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setImmersive((v) => !v)} aria-label={immersive ? '退出沉浸阅读' : '沉浸阅读'}>
          {immersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
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

      {/* 正文（章节/分页切换时淡入上浮） */}
      <article
        key={`${chapterId}-${mode}-${pageIdx}`}
        onClick={tapToggleBars}
        className={`reader-fade-in min-h-[60vh] cursor-default select-text px-2 pb-10 transition-colors duration-300 ${
          theme === 'paper'
            ? 'reading-article mt-4 rounded-2xl border border-[hsl(40_30%_72%)] bg-[#f5ecd9] p-5 text-[#33302a] shadow-[0_12px_30px_-14px_hsl(0_0%_0%/0.5)] sm:p-7'
            : theme === 'night'
              ? 'reading-article mt-4 rounded-2xl bg-black/50 p-5 text-foreground/80 sm:p-7'
              : 'reading-article text-foreground/90'
        }`}
        style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily: fontStack(prefs?.fontFamily ?? 'system') }}
      >
        <h1
          className={`mb-1 font-serif text-xl font-bold ${
            theme === 'paper' ? 'text-[#2c2720]' : theme === 'night' ? 'text-foreground' : 'text-gradient-anime'
          }`}
        >
          {chapter.title}
        </h1>
        <p className={`mb-6 text-xs ${theme === 'paper' ? 'text-[#8a7c66]' : 'text-muted-foreground'}`}>
          第{chapter.index}章 · {book.title} · {book.authorName}
          {mode === 'page' && ` · 第 ${pageIdx + 1} / ${pageCount} 页`}
        </p>
        {pageParas.map((p, i) => (
          <p key={i} className="mb-4 text-justify">
            {p}
          </p>
        ))}
        {mode === 'page' && pageIdx < pageCount - 1 && (
          <p className={`mt-8 text-center text-xs ${theme === 'paper' ? 'text-[#a89472]' : 'text-muted-foreground'}`}>
            ✦ · 本页完 · 继续向下 · ✦
          </p>
        )}
      </article>

      {/* 章末书灵彩蛋：读完本章时出现（最后一页 / 滚动模式本章完整） */}
      {(mode === 'page' ? pageIdx >= pageCount - 1 : true) && (
        <div className="anim-fade-up my-2 flex items-center justify-center gap-3 card-anime rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-[0_12px_32px_-20px_hsl(333_92%_66%/0.45)]">
          <div className="mascot-bounce shrink-0">
            <MoyingMascot mood="happy" size={48} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {index >= chapters.length - 1
              ? '已经追到最新一章，书灵和你一起等更新'
              : '这一章读完啦，书灵陪你翻下一章'}
          </p>
        </div>
      )}

      {/* 翻页（沉浸阅读时同步淡出） */}
      <div
        className={`border-t border-border py-4 transition-all duration-300 ${
          immersive ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        {/* 阅读模式切换：连续滚动 / 分页翻读 */}
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="text-[11px] text-muted-foreground">阅读模式</span>
          <div className="flex rounded-full border border-border bg-muted/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => switchMode('scroll')}
              className={`rounded-full px-3 py-1 transition-colors ${mode === 'scroll' ? 'bg-gradient-to-r from-[hsl(275_84%_62%)] to-[hsl(333_92%_66%)] font-medium text-white' : 'text-muted-foreground'}`}
            >
              连续滚动
            </button>
            <button
              type="button"
              onClick={() => switchMode('page')}
              className={`rounded-full px-3 py-1 transition-colors ${mode === 'page' ? 'bg-gradient-to-r from-[hsl(275_84%_62%)] to-[hsl(333_92%_66%)] font-medium text-white' : 'text-muted-foreground'}`}
            >
              分页翻读
            </button>
          </div>
        </div>

        {mode === 'page' ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageIdx <= 0}
              onClick={() => {
                setPageIdx((p) => Math.max(0, p - 1));
                window.scrollTo(0, 0);
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> 上一页
            </Button>
            <span className="text-xs text-muted-foreground">
              第 {pageIdx + 1} / {pageCount} 页 · 章 {index + 1}/{chapters.length}
            </span>
            <Button
              size="sm" className="btn-anime"
              disabled={pageIdx >= pageCount - 1}
              onClick={() => {
                setPageIdx((p) => Math.min(pageCount - 1, p + 1));
                window.scrollTo(0, 0);
              }}
            >
              下一页 <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
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
              className="btn-anime"
              disabled={index >= chapters.length - 1}
              onClick={() => navigate(`/read/${bookId}/${chapters[index + 1].id}`)}
            >
              下一章 <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
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
