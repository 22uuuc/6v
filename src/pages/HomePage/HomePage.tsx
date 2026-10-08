// EXPORTS: HomePage（组件文件）
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquareText, BookOpenText, Images, Clapperboard } from 'lucide-react';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import SceneArt from '@/components/SceneArt';
import BookCard from '@/components/BookCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BookType } from '@/lib/types';

const TYPE_ENTRY = [
  {
    type: 'novel' as BookType,
    title: '普通小说',
    desc: '沉浸式文字阅读，章节连载，随心追更',
    icon: BookOpenText,
    tile: 'icon-tile-gold',
  },
  {
    type: 'visual' as BookType,
    title: '画面互动小说',
    desc: '插画场景 + 画面人物，你的选择决定结局',
    icon: MessageSquareText,
    tile: 'icon-tile-violet',
  },
  {
    type: 'comic' as BookType,
    title: '漫画',
    desc: '分镜画面，一话一话追下去',
    icon: Images,
    tile: 'icon-tile-pink',
  },
  {
    type: 'anime' as BookType,
    title: '动漫视频',
    desc: '管理员上架，一集一集看',
    icon: Clapperboard,
    tile: 'icon-tile-blue',
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

export default function HomePage() {
  useDataVersion();
  const navigate = useNavigate();
  const published = api.publishedBooks();
  const announcement = api.getSettings().announcement;
  const featured = api.featuredBooks();
  const hot = [...published].sort((a, b) => b.views - a.views).slice(0, 5);
  const fresh = [...published].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 6);
  const entryCount = (t: BookType) => published.filter((b) => b.type === t).length;

  return (
    <div className="space-y-8">
      {announcement && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-xs text-primary">
          {announcement}
        </div>
      )}

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
              onClick={() => navigate(`/category/all?genre=${encodeURIComponent(g.label)}`)}
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

      {/* 分类入口 */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPE_ENTRY.map((e) => (
            <Link key={e.type} to={`/category/${e.type}`}>
              <Card className="card-anime card-hover-glow h-full">
                <CardContent className="flex items-start gap-4 p-5">
                  <span className={`icon-tile ${e.tile} flex h-12 w-12 shrink-0 items-center justify-center rounded-xl`}>
                    <e.icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-medium">
                      {e.title}
                      <span className="text-xs text-muted-foreground">{entryCount(e.type)} 部</span>
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{e.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 编辑推荐（管理员推流量）：首本加大错落 */}
      {featured.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2 font-serif text-lg font-bold">
              编辑推荐
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-normal text-primary">管理员推流量</span>
            </h2>
            <Link to="/category/all" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              全部作品 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {featured.slice(0, 6).map((book, i) => (
              <div key={book.id} className={i === 0 ? 'sm:col-span-2 sm:row-span-2' : ''}>
                <BookCard book={book} />
              </div>
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

      {/* 新书上架 */}
      <section>
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
