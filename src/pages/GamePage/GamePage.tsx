// EXPORTS: GamePage（组件文件）
// 游戏上架页：展示游戏作品并内置试玩（memory = 翻牌记忆配对，纯前端轻量玩法）
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gamepad2, RotateCcw, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/** 翻牌记忆配对：6 对主题牌面 */
const MEMORY_FACES = ['📖', '✨', '🌙', '⭐', '🌸', '🎴'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 翻牌记忆小游戏（memory 模板） */
function MemoryGame({ onWin }: { onWin: (steps: number) => void }) {
  const deck = useMemo(() => shuffle([...MEMORY_FACES, ...MEMORY_FACES]), []);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [steps, setSteps] = useState(0);
  const done = matched.length === deck.length;

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    const timer = setTimeout(() => {
      if (deck[a] === deck[b]) setMatched((m) => [...m, a, b]);
      setFlipped([]);
    }, 650);
    return () => clearTimeout(timer);
  }, [flipped, deck]);

  useEffect(() => {
    if (done) onWin(Math.max(1, Math.round(steps / 2)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const flip = (i: number) => {
    if (flipped.length >= 2 || flipped.includes(i) || matched.includes(i)) return;
    setFlipped((f) => {
      const next = [...f, i];
      if (next.length === 2) setSteps((s) => s + 1);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>翻开两张相同牌面即可消除</span>
        <span>步数：{Math.max(1, Math.round(steps / 2))} · 已配对 {matched.length / 2} / {deck.length / 2}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {deck.map((face, i) => {
          const open = flipped.includes(i) || matched.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => flip(i)}
              aria-label={open ? `牌面 ${face}` : '未翻开的牌'}
              className={`flex aspect-[3/4] items-center justify-center rounded-xl text-2xl shadow-sm transition-all duration-300 sm:text-3xl ${
                open
                  ? matched.includes(i)
                    ? 'border border-primary/40 bg-primary/10 opacity-70'
                    : 'border border-primary/50 bg-card scale-[1.03]'
                  : 'border border-border bg-gradient-to-br from-[hsl(9_88%_52%/0.2)] to-[hsl(12_92%_60%/0.16)] hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              {open ? face : <span className="font-serif text-base font-bold text-primary/70">墨</span>}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="anim-fade-up flex scale-in items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          <Trophy className="h-4 w-4" /> 通关！共用 {Math.max(1, Math.round(steps / 2))} 步配对全部卡牌
        </div>
      )}
    </div>
  );
}

export default function GamePage() {
  const { bookId = '' } = useParams();
  const navigate = useNavigate();
  useDataVersion();
  const book = api.getBook(bookId);
  const [playing, setPlaying] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!book || book.type !== 'game' || book.status !== 'published') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 返回
        </Button>
        <EmptyState text="游戏不存在或未上架" />
      </div>
    );
  }

  const win = (steps: number) => setBest((b) => (b === null ? steps : Math.min(b, steps)));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/book/${bookId}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> 返回详情
      </Button>

      {/* 游戏头图区 */}
      <section className="relative overflow-hidden rounded-2xl border border-border">
        <div className="relative h-44 w-full sm:h-52">
          <div className="absolute inset-0 scale-110 blur-sm">
            <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont}  charArt={book.type === 'visual'} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-4">
            <div className="w-24 shrink-0 sm:w-28">
              <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont}  charArt={book.type === 'visual'} />
            </div>
            <div className="min-w-0 pb-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <Badge className="gap-1"><Gamepad2 className="h-3 w-3" /> 游戏</Badge>
                <Badge variant="secondary">{book.genre}</Badge>
                {best !== null && <Badge variant="outline" className="gap-1"><Trophy className="h-3 w-3" /> 最佳 {best} 步</Badge>}
              </div>
              <h1 className="truncate font-serif text-xl font-bold sm:text-2xl">{book.title}</h1>
              <p className="text-xs text-muted-foreground">{book.authorName} 出品</p>
            </div>
          </div>
        </div>
      </section>

      {/* 游戏试玩区 */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2 font-medium">
              <Gamepad2 className="h-4 w-4 text-primary" /> 开始试玩
            </h2>
            {playing && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setRound((r) => r + 1)}>
                <RotateCcw className="h-3.5 w-3.5" /> 重新开始
              </Button>
            )}
          </div>
          {book.gameKind === 'memory' ? (
            playing ? (
              <MemoryGame key={round} onWin={win} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-muted-foreground">{book.description.split('：')[0]}</p>
                <Button size="lg" className="btn-anime gap-2" onClick={() => { setPlaying(true); setRound((r) => r + 1); }}>
                  <Gamepad2 className="h-4.5 w-4.5" /> 开始游戏
                </Button>
              </div>
            )
          ) : (
            <EmptyState text="该游戏暂无可试玩版本" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="section-title mb-2 font-medium">游戏介绍</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{book.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
