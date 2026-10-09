// EXPORTS: UploadGamePage（组件文件）
// 游戏上架：填写游戏信息并选择试玩模板（当前内置翻牌记忆配对），无章节概念
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Send, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { idbPut } from '@/lib/idb';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookInfoFields from '@/components/BookInfoFields';
import { EMPTY_DRAFT, type IBookDraft } from '@/lib/upload-types';
import type { GameKind } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** 可选试玩模板 */
const GAME_TEMPLATES: { kind: GameKind; label: string; desc: string; emoji: string }[] = [
  { kind: 'memory', label: '翻牌记忆', desc: '配对全部卡牌，考验记忆力', emoji: '🎴' },
];

export default function UploadGamePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useDataVersion();

  const editId = params.get('edit');
  const existing = editId ? api.getBook(editId) : null;

  const [draft, setDraft] = useState<IBookDraft>(() =>
    existing
      ? { ...EMPTY_DRAFT, title: existing.title, genre: existing.genre, coverScene: existing.coverSeed, coverStyle: existing.coverStyle ?? 'anime', coverType: existing.coverType ?? 'svg', coverFont: existing.coverFont ?? 'default', tags: existing.tags.join(','), description: existing.description, serial: existing.serial, chapterPrice: 0 }
      : { ...EMPTY_DRAFT, serial: 'finished' },
  );
  const [gameKind, setGameKind] = useState<GameKind>(existing?.gameKind ?? 'memory');

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return <p className="py-20 text-center text-sm text-muted-foreground">需要创作者身份</p>;
  }
  if (existing && existing.authorId !== user.id && user.role !== 'admin') {
    return <p className="py-20 text-center text-sm text-muted-foreground">只能编辑自己的作品</p>;
  }

  const submit = async (saveDraft = false) => {
    if (!draft.title.trim()) {
      toast.error('请填写游戏名称');
      return;
    }
    if (!draft.description.trim()) {
      toast.error('请填写游戏介绍');
      return;
    }
    try {
      const common = {
        title: draft.title.trim(),
        genre: draft.genre,
        coverSeed: draft.coverScene,
        coverStyle: draft.coverStyle,
        coverType: draft.coverType,
        coverFont: draft.coverFont,
        tags: draft.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        description: draft.description.trim(),
        serial: 'finished' as const,
        chapterPrice: 0,
        gameKind,
      };
      if (existing) {
        api.updateBook(existing.id, common);
        if (draft.coverFile) await idbPut(`cover:${existing.id}`, draft.coverFile);
        api.setBookStatus(existing.id, 'pending', '', user.id);
        toast.success(existing.status === 'published' ? '内容已更新，已重新提交审核，审核通过后自动上架' : '已保存并提交审核');
      } else {
        const book = api.createBook({
          type: 'game',
          ...common,
          authorId: user.id,
          authorName: user.nickname,
          status: saveDraft ? 'draft' : 'pending',
        });
        if (draft.coverFile) await idbPut(`cover:${book.id}`, draft.coverFile);
        toast.success(saveDraft ? '已保存到草稿箱' : '游戏已提交，等待管理员审核上架');
      }
      navigate('/creator');
    } catch (e) {
      // 数据层拦截（病毒载荷/脏数据）抛错时给出明确提示，且不跳转
      toast.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creator')} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="font-serif text-xl font-bold">{existing ? '编辑游戏' : '游戏上架'}</h1>
          <p className="text-xs text-muted-foreground">选择试玩模板，审核通过后读者可在游戏页直接开玩</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <BookInfoFields draft={draft} onChange={setDraft} bookId={existing?.id} existingCoverType={existing?.coverType} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <Gamepad2 className="h-4 w-4 text-primary" /> 试玩模板
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {GAME_TEMPLATES.map((t) => (
              <button
                key={t.kind}
                type="button"
                onClick={() => setGameKind(t.kind)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                  gameKind === t.kind ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/50',
                )}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">游戏为整本体验，无需章节；读者试玩免费，可对作品打赏</p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => navigate('/creator')}>取消返回</Button>
        <Button variant="outline" onClick={() => submit(true)} className="gap-1.5">
          <Save className="h-4 w-4" /> 保存草稿
        </Button>
        <Button onClick={() => submit(false)} className="gap-1.5">
          <Send className="h-4 w-4" /> {existing ? '保存并提交审核' : '提交审核'}
        </Button>
      </div>
    </div>
  );
}
