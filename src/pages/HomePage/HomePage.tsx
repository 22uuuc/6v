// EXPORTS: HomePage（组件文件）
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquareText, BookOpenText, Images, Flame, Megaphone, LibraryBig, BadgeCheck, LayoutGrid, MessagesSquare, Gamepad2, Clapperboard, Video } from 'lucide-react';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import SceneArt from '@/components/SceneArt';
import BookCover from '@/components/BookCover';
import BookCard from '@/components/BookCard';
import MoyingMascot from '@/components/MoyingMascot';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BookType, IBook } from '@/lib/types';
import { CHANNELS } from '@/lib/types';

const TYPE_ENTRY = [
  {
    key: 'novel',
    title: '小说',
    desc: '沉浸式文字阅读，章节连载，随心追更',
    icon: BookOpenText,
    tile: 'icon-tile-gold',
  },
  {
    key: 'comic',
    title: '漫画',
    desc: '分镜与气泡，一话一话追下去',
    icon: Images,
    tile: 'icon-tile-pink',
  },
  {
    key: 'anime',
    title: '动漫',
    desc: '动画番剧，管理员独家上传',
    icon: Clapperboard,
    tile: 'icon-tile-violet',
  },
  {
    key: 'video',
    title: '视频',
    desc: '画面互动与对话剧情，像追剧一样追下去',
    icon: Video,
    tile: 'icon-tile-blue',
  },
  {
    key: 'game',
    title: '游戏',
    desc: '可直接开玩的游戏作品，挑战最好成绩',
    icon: Gamepad2,
    tile: 'icon-tile-teal',
  },
];

/** 热门题材胶囊（跳转书城并按题材过滤） */
const HOT_GENRES: { label: string; chip: string }[] = [
  { label: '玄幻', chip: 'chip-violet' },
  { label: '都市', chip: 'chip-teal' },
  { label: '青春', chip: 'chip-pink' },
  { label: '悬疑', chip: 'chip-gold' },
  { label: '轻小说', chip: 'chip-blue' },
  { label: '科幻', chip: 'chip-blue' },
  { label: '武侠', chip: 'chip-teal' },
  { label: '奇幻', chip: 'chip-violet' },
];

const PUSH_TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话', game: '游戏' };

type PushItem = { kind: 'notice'; text: string } | { kind: 'book'; book: IBook };

/** 题材 → 轮播背景场景画（复用 12 场景插画体系） */
const GENRE_SCENE: Record<string, string> = {
  玄幻: 'mountain', 仙侠: 'mountain', 武侠: 'tea-house', 古言: 'tea-house', 历史: 'tea-house',
  都市: 'night-city', 现实: 'street', 科幻: 'space', 游戏: 'forest', 奇幻: 'forest',
  悬疑: 'ghost', 青春: 'campus', 言情: 'campus', 轻小说: 'sea',
};
const genreScene = (g: string) => GENRE_SCENE[g] ?? 'night-city';

/** 三宫格快捷入口（参考短篇站：最新入库 / 完本精品 / 分类） */
const QUICK_ENTRIES: {
  key: string; label: string; desc: string; icon: typeof LibraryBig;
  tile: string; card: string; to?: string; anchor?: string;
}[] = [
  {
    key: 'fresh', label: '最新入库', desc: '刚点亮的故事', icon: LibraryBig,
    tile: 'from-rose-400 to-orange-400', card: 'from-rose-500/12 to-orange-300/10', anchor: 'fresh',
  },
  {
    key: 'finished', label: '完本精品', desc: '一口气看到结局', icon: BadgeCheck,
    tile: 'from-amber-400 to-orange-400', card: 'from-amber-400/14 to-yellow-300/10', to: '/category/all?serial=finished',
  },
  {
    key: 'genre', label: '分类', desc: '按题材逛书城', icon: LayoutGrid,
    tile: 'from-violet-400 to-fuchsia-400', card: 'from-violet-500/12 to-fuchsia-300/10', to: '/category/all',
  },
];

/** 动漫风推送栏：公告 + 热门作品轮播（4 秒一换，点击直达详情） */
export function PushBar({ announcement, books }: { announcement: string; books: IBook[] }) {
  const items = useMemo<PushItem[]>(
    () => [
      ...(announcement ? [{ kind: 'notice' as const, text: announcement }] : []),
      ...books.map((b) => ({ kind: 'book' as const, book: b })),
    ],
    [announcement, books],
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;
  const it = items[idx % items.length];
  return (
    <div className="relative flex h-9 items-center gap-2.5 overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-[hsl(275_84%_62%/0.16)] via-card to-[hsl(333_92%_66%/0.12)] px-3">
      <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="shrink-0 rounded-md bg-gradient-to-r from-[hsl(333_92%_66%)] to-[hsl(275_84%_62%)] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
        推送
      </span>
      <div key={idx} className="anim-fade-up min-w-0 flex-1 truncate text-xs">
        {it.kind === 'notice' ? (
          <span className="text-primary/90">{it.text}</span>
        ) : (
          <Link to={`/book/${it.book.id}`} className="flex min-w-0 items-center gap-1.5 truncate hover:text-primary">
            <Flame className="h-3 w-3 shrink-0 text-[hsl(6_72%_58%)]" />
            <span className="truncate font-medium">{it.book.title}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{PUSH_TYPE_LABEL[it.book.type]}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">{it.book.views.toLocaleString('zh-CN')} 在追</span>
          </Link>
        )}
      </div>
      <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" />
    </div>
  );
}

/** 大 Banner 轮播（参考短篇站《溯雨三日》横幅）：场景画打底 +《书名》大字 + 右侧封面悬浮 + 圆点分页，5 秒自动轮播 */
function BannerCarousel({ books, label }: { books: IBook[]; label: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (books.length <= 1) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % books.length), 5000);
    return () => clearInterval(timer);
  }, [books.length]);

  if (books.length === 0) return null;
  const b = books[idx % books.length];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg shadow-primary/10">
      <div key={b.id} className="anim-fade-up relative h-64 w-full md:h-72">
        {/* 场景画打底（按题材自动换景） */}
        <SceneArt scene={genreScene(b.genre)} seed={`banner-${b.coverSeed}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/55 to-background/10" />
        <div className="anime-glow" />
        {/* 右侧作品封面悬浮（桌面端） */}
        <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 rotate-2 md:block lg:right-16">
          <div className="w-32 overflow-hidden rounded-xl shadow-2xl shadow-black/50 ring-2 ring-white/25 lg:w-36">
            <BookCover
              seed={b.coverSeed}
              title={b.title}
              author={b.authorName}
              genre={b.genre}
              style={b.coverStyle}
              bookId={b.id}
              coverType={b.coverType}
              font={b.coverFont}
            />
          </div>
        </div>
        {/* 左侧文案（书名 / 作者行 / 简介，参考《溯雨三日》排版） */}
        <Link
          to={`/book/${b.id}`}
          className="absolute inset-0 flex flex-col justify-center gap-2.5 p-6 md:p-10"
          aria-label={`阅读《${b.title}》`}
        >
          <span className="w-fit rounded-md bg-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary backdrop-blur">
            {label} · {PUSH_TYPE_LABEL[b.type]}
          </span>
          <h3 className="font-serif text-2xl font-bold tracking-widest text-foreground drop-shadow-sm md:text-4xl">
            《{b.title}》
          </h3>
          <p className="text-xs text-muted-foreground md:text-sm">◎ {b.authorName} / {b.genre}</p>
          <p className="line-clamp-2 max-w-md text-xs leading-relaxed text-muted-foreground md:text-sm">
            {b.description}
          </p>
        </Link>
      </div>
      {/* 圆点分页（点击切换） */}
      {books.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {books.map((book, i) => (
            <button
              key={book.id}
              type="button"
              aria-label={`切换到《${book.title}》`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx % books.length ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  useDataVersion();
  const navigate = useNavigate();
  const published = api.publishedBooks();
  const announcement = api.getSettings().announcement;
  const featured = api.featuredBooks();
  const hot = [...published].sort((a, b) => b.views - a.views).slice(0, 5);
  const fresh = [...published].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 6);
  const best = [...published].sort((a, b) => b.rating - a.rating).slice(0, 4);
  const bannerBooks = featured.length > 0 ? featured.slice(0, 5) : hot;
  const entryCount = (key: string) => {
    const ch = CHANNELS.find((c) => c.key === key);
    return ch ? published.filter((b) => ch.types.includes(b.type)).length : 0;
  };
  const gotoAnchor = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-8">
      {/* 动漫风推送栏：公告 + 热门作品轮播 */}
      <PushBar announcement={announcement} books={hot} />

      {/* Hero 画境 */}
      <section className="anim-fade-up relative overflow-hidden rounded-2xl border border-border">
        <div className="relative h-60 w-full md:h-80">
          <SceneArt scene="mountain" seed="hero-mountain" />
          {/* 动漫平台光斑 */}
          <div className="anime-glow" />
          {/* 极光氛围覆盖（紫粉蓝，番剧海报感） */}
          <div className="hero-aurora absolute inset-0" />
          {/* 星尘粒子 */}
          {[
            { left: '12%', top: '18%', size: 3, delay: '0s' },
            { left: '78%', top: '26%', size: 4, delay: '1.2s' },
            { left: '34%', top: '58%', size: 2, delay: '2.4s' },
            { left: '62%', top: '12%', size: 3, delay: '3.6s' },
            { left: '90%', top: '64%', size: 2, delay: '0.8s' },
            { left: '24%', top: '30%', size: 2, delay: '4.6s' },
            { left: '52%', top: '74%', size: 3, delay: '2s' },
            { left: '8%', top: '72%', size: 2, delay: '5.4s' },
          ].map((p, i) => (
            <span
              key={i}
              className="star-drift"
              style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }}
            />
          ))}
          {/* 墨影书灵：IP 吉祥物漂浮（手机小号、桌面大号） */}
          <div className="mascot-float absolute right-4 top-4 md:right-10 md:top-8">
            <div className="drop-shadow-[0_0_18px_rgba(168,130,255,0.45)]">
              <MoyingMascot mood="reading" size={64} className="md:hidden" />
              <MoyingMascot mood="reading" size={104} className="hidden md:block" />
            </div>
          </div>
          {/* 写意墨点与云纹装饰层（国风氛围，缓慢漂移） */}
          <span className="drift-slow absolute right-[24%] top-[16%] h-14 w-14 rounded-full bg-primary/15 blur-md" />
          <span className="drift-slower absolute left-[9%] top-[42%] h-6 w-6 rounded-full bg-accent/25 blur-[2px]" />
          <span className="drift-slow absolute right-[9%] bottom-[22%] h-8 w-8 rounded-full bg-[hsl(333_92%_66%)]/20 blur-sm" />
          <span className="drift-slower absolute left-[22%] bottom-[14%] h-3 w-3 rounded-full bg-primary/30" />
          <svg
            className="drift-slow absolute right-[15%] top-[46%] hidden h-16 w-24 opacity-60 md:block"
            viewBox="0 0 96 64"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 40 Q20 20 36 32 Q48 42 60 30 Q74 16 88 28"
              stroke="hsl(var(--primary) / 0.35)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M12 50 Q26 34 42 44 Q56 52 68 42"
              stroke="hsl(var(--accent) / 0.3)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-5 md:p-8">
            <Badge className="bg-primary/20 text-primary backdrop-blur">一页一画 · 有画面的故事</Badge>
            <h1 className="text-gradient-anime font-serif text-2xl font-bold tracking-widest md:text-4xl">墨影书城</h1>
            <p className="max-w-md text-sm text-muted-foreground md:text-base">
              小说、画面互动小说、漫画、动漫视频，四种读法都在夜里点灯。创作者上传作品，读者用书币支持，好故事自己会发光。
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm" className="btn-anime gap-1.5">
                <Link to="/category/all">
                  开始阅读 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/creator">成为创作者</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 热门题材胶囊（动漫平台题材标签，点击跳书城并过滤） */}
      <section>
        <div className="flex flex-wrap gap-2">
          {HOT_GENRES.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => navigate(`/category/novel?genre=${encodeURIComponent(g.label)}`)}
              className={`chip-grad ${g.chip} rounded-full px-3.5 py-1.5 text-xs font-medium`}
            >
              {g.label}
            </button>
          ))}
          <Link to="/rank" className="chip-grad chip-gold rounded-full px-3.5 py-1.5 text-xs font-medium">
            🏆 排行榜
          </Link>
        </div>
      </section>

      {/* 分类入口（写意手绘描边 · 微旋错落 · 图标浮动） */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TYPE_ENTRY.map((e, i) => (
            <Link
              key={e.key}
              to={`/category/${e.key}`}
              className={`block ${i % 2 === 1 ? 'lg:translate-y-2' : ''}`}
            >
              <Card
                className={`card-anime sketch-card h-full ${i % 2 === 1 ? 'rotate-[0.8deg]' : 'rotate-[-0.8deg]'}`}
              >
                <CardContent className="relative flex items-start gap-4 p-5">
                  {/* 写意点缀：角落星点 */}
                  <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-primary/30" />
                  <span className="absolute right-7 top-5 h-1 w-1 rounded-full bg-accent/40" />
                  <span className={`icon-tile ${e.tile} float-slow flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl`}>
                    <e.icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-medium">
                      {e.title}
                      <span className="text-xs text-muted-foreground">{entryCount(e.key)} 部</span>
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{e.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 大 Banner 轮播（编辑推荐作品 / 无推荐时热门放送） */}
      <section className="anim-fade-up">
        <BannerCarousel books={bannerBooks} label={featured.length > 0 ? '编辑推荐' : '热门放送'} />
      </section>

      {/* 三宫格快捷入口（最新入库 / 完本精品 / 分类） */}
      <section>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {QUICK_ENTRIES.map((e) => {
            const inner = (
              <Card className={`card-anime h-full border-border bg-gradient-to-br ${e.card} transition-transform hover:-translate-y-0.5`}>
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center sm:p-5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${e.tile} text-white shadow-md sm:h-12 sm:w-12`}>
                    <e.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{e.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{e.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
            return e.to ? (
              <Link key={e.key} to={e.to} className="block">
                {inner}
              </Link>
            ) : (
              <button key={e.key} type="button" onClick={() => gotoAnchor(e.anchor!)} className="block w-full text-left">
                {inner}
              </button>
            );
          })}
        </div>
      </section>

      {/* 精品推荐（高分佳作：封面左 + 文案右的列表布局） */}
      {best.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="section-title font-serif text-lg font-bold">精品推荐</h2>
              <p className="mt-1 text-xs text-muted-foreground">读者口碑之选 · 按评分排序</p>
            </div>
            <Link to="/category/all" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              全部作品 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {best.map((book) => (
              <Link
                key={book.id}
                to={`/book/${book.id}`}
                className="flex gap-4 rounded-2xl border border-border bg-card/60 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 sm:p-4"
              >
                <div className="w-20 shrink-0 sm:w-24">
                  <BookCover
                    seed={book.coverSeed}
                    title={book.title}
                    author={book.authorName}
                    genre={book.genre}
                    style={book.coverStyle}
                    bookId={book.id}
                    coverType={book.coverType}
                    font={book.coverFont}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <h3 className="truncate font-serif text-base font-bold sm:text-lg">{book.title}</h3>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{book.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{book.genre}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ${
                        book.serial === 'finished' ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400' : 'bg-teal-400/15 text-teal-600 dark:text-teal-400'
                      }`}
                    >
                      {book.serial === 'finished' ? '完结' : '连载中'}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">★ {book.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground/70">{book.views.toLocaleString('zh-CN')} 在追</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 热门榜：前三名错落，第一名跨双列 */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="section-title font-serif text-lg font-bold">热门榜</h2>
            <p className="mt-1 text-xs text-muted-foreground">读者正在追 · 按浏览量排序</p>
          </div>
          <Link to="/category/all" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            全部作品 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {hot.map((book, i) => (
            <div key={book.id} className={`relative ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <BookCard book={book} />
              <span
                className={`absolute -left-1.5 -top-2 flex h-7 w-7 items-center justify-center rounded-lg font-serif text-sm font-bold shadow ${
                  i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'bg-primary text-primary-foreground'
                }`}
              >
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 新书上架（「最新入库」快捷入口的滚动锚点） */}
      <section id="fresh">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="section-title font-serif text-lg font-bold">新书上架</h2>
            <p className="mt-1 text-xs text-muted-foreground">刚点亮的故事 · 按上架时间</p>
          </div>
          <Link to="/category/all" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            全部作品 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {fresh.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>

      {/* 分类浏览 */}
      <section>
        <div className="mb-4">
          <h2 className="section-title font-serif text-lg font-bold">逛书城</h2>
          <p className="mt-1 text-xs text-muted-foreground">四种读法，一个书城</p>
        </div>
        <Tabs defaultValue="all">
          <TabsList className="mb-5">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="novel">普通小说</TabsTrigger>
            <TabsTrigger value="visual">互动小说</TabsTrigger>
            <TabsTrigger value="comic">漫画</TabsTrigger>
            <TabsTrigger value="anime">动漫视频</TabsTrigger>
          </TabsList>
          {(['all', 'novel', 'visual', 'comic', 'anime'] as const).map((t) => (
            <TabsContent key={t} value={t}>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                {published
                  .filter((b) => t === 'all' || b.type === t)
                  .slice(0, 12)
                  .map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
