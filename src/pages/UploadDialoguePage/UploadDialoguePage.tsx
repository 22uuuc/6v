// EXPORTS: UploadDialoguePage（组件文件）
// 上传对话小说：聊天气泡编辑器（说话人 + 台词 + 左右方向），存储为行格式正文
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Send, Save, MessagesSquare, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { idbPut } from '@/lib/idb';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { parseDialogue, serializeDialogue, type IDialogueLine } from '@/lib/dialogue';
import BookInfoFields from '@/components/BookInfoFields';
import { EMPTY_DRAFT, type IBookDraft } from '@/lib/upload-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface IChapterDraft {
  title: string;
  lines: IDialogueLine[];
  price: number;
}

const newLine = (): IDialogueLine => ({ speaker: '', text: '', side: 'L' });

export default function UploadDialoguePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useDataVersion();

  const editId = params.get('edit');
  const existing = editId ? api.getBook(editId) : null;

  const [draft, setDraft] = useState<IBookDraft>(() =>
    existing
      ? { ...EMPTY_DRAFT, title: existing.title, genre: existing.genre, coverScene: existing.coverSeed, coverStyle: existing.coverStyle ?? 'classic', coverType: existing.coverType ?? 'svg', coverFont: existing.coverFont ?? 'default', tags: existing.tags.join(','), description: existing.description, serial: existing.serial, chapterPrice: existing.chapterPrice }
      : EMPTY_DRAFT,
  );
  const [chapters, setChapters] = useState<IChapterDraft[]>(() =>
    existing && existing.type === 'dialogue'
      ? api.chaptersOf(existing.id).map((c) => ({ title: c.title, lines: parseDialogue(c.content), price: c.price }))
      : [{ title: '', lines: [newLine()], price: 0 }],
  );

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return <p className="py-20 text-center text-sm text-muted-foreground">需要创作者身份</p>;
  }
  if (existing && existing.authorId !== user.id && user.role !== 'admin') {
    return <p className="py-20 text-center text-sm text-muted-foreground">只能编辑自己的作品</p>;
  }

  const setChapter = (i: number, patch: Partial<IChapterDraft>) =>
    setChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const setLine = (ci: number, li: number, patch: Partial<IDialogueLine>) =>
    setChapters((cs) =>
      cs.map((c, idx) => (idx === ci ? { ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, ...patch } : l)) } : c)),
    );

  const submit = async (saveDraft = false) => {
    if (!draft.title.trim()) {
      toast.error('请填写书名');
      return;
    }
    const valid = chapters
      .map((c) => ({ ...c, content: serializeDialogue(c.lines) }))
      .filter((c) => c.title.trim() && c.content);
    if (valid.length === 0) {
      toast.error('至少需要一个完整章节（标题 + 至少一条对话气泡）');
      return;
    }
    try {
      if (existing) {
        await api.updateBook(existing.id, {
          title: draft.title.trim(),
          genre: draft.genre,
          coverSeed: draft.coverScene,
          coverStyle: draft.coverStyle,
          coverType: draft.coverType,
          coverFont: draft.coverFont,
          tags: draft.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          description: draft.description.trim(),
          serial: draft.serial,
          chapterPrice: draft.chapterPrice,
        });
        if (draft.coverFile) await idbPut(`cover:${existing.id}`, draft.coverFile);
        await api.saveChapters(
          existing.id,
          valid.map((c, i) => ({ title: c.title.trim(), content: c.content, price: c.price, index: i + 1 })),
        );
        void api.setBookStatus(existing.id, 'pending', '', user.id);
        toast.success(existing.status === 'published' ? '内容已更新，已重新提交审核，审核通过后自动上架' : '已保存并提交审核');
      } else {
        const book = await api.createBook({
          type: 'dialogue',
          title: draft.title.trim(),
          genre: draft.genre,
          coverSeed: draft.coverScene,
          coverStyle: draft.coverStyle,
          coverType: draft.coverType,
          coverFont: draft.coverFont,
          tags: draft.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          description: draft.description.trim(),
          serial: draft.serial,
          chapterPrice: draft.chapterPrice,
          authorId: user.id,
          authorName: user.nickname,
          status: saveDraft ? 'draft' : 'pending',
        });
        if (draft.coverFile) await idbPut(`cover:${book.id}`, draft.coverFile);
        await api.saveChapters(
          book.id,
          valid.map((c, i) => ({ title: c.title.trim(), content: c.content, price: c.price, index: i + 1 })),
        );
        toast.success(saveDraft ? '已保存到草稿箱' : '作品已提交，等待管理员审核上架');
      }
      navigate('/creator');
    } catch (e) {
      // 数据层拦截（病毒载荷/脏数据）抛错时给出明确提示，且不跳转
      toast.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  return (<div className="page-enter mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creator')} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="font-serif text-xl font-bold">{existing ? '编辑对话小说' : '上传对话小说'}</h1>
          <p className="text-xs text-muted-foreground">以聊天气泡推进剧情，读者侧按左右角色对话呈现</p>
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
            <MessagesSquare className="h-4 w-4 text-primary" /> 章节（{chapters.length}）
          </h2>
          <div className="space-y-4">
            {chapters.map((ch, ci) => (
              <div key={ci} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">第{ci + 1}章</span>
                  <Input
                    value={ch.title}
                    onChange={(e) => setChapter(ci, { title: e.target.value })}
                    placeholder="章节标题"
                    className="h-8 flex-1"
                    maxLength={20}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={ch.price}
                    onChange={(e) => setChapter(ci, { price: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-8 w-24"
                    placeholder="价格(币)"
                    aria-label="章节价格"
                  />
                  <Button size="icon" variant="ghost" aria-label="删除章节" onClick={() => setChapters((cs) => cs.filter((_, idx) => idx !== ci))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {/* 气泡编辑列表 */}
                <div className="space-y-2">
                  {ch.lines.map((line, li) => (
                    <div key={li} className="flex items-center gap-1.5">
                      <Input
                        value={line.speaker}
                        onChange={(e) => setLine(ci, li, { speaker: e.target.value })}
                        placeholder="说话人"
                        className="h-8 w-24 shrink-0"
                        maxLength={10}
                        aria-label="说话人"
                      />
                      <Input
                        value={line.text}
                        onChange={(e) => setLine(ci, li, { text: e.target.value })}
                        placeholder="台词内容"
                        className="h-8 flex-1"
                        aria-label="台词"
                      />
                      <Button
                        size="sm"
                        variant={line.side === 'R' ? 'default' : 'outline'}
                        className="h-8 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => setLine(ci, li, { side: line.side === 'R' ? 'L' : 'R' })}
                        aria-label="切换对话方向"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        {line.side === 'R' ? '右' : '左'}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        aria-label="删除气泡"
                        onClick={() => setChapter(ci, { lines: ch.lines.filter((_, j) => j !== li) })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => setChapter(ci, { lines: [...ch.lines, newLine()] })}
                >
                  <Plus className="h-3.5 w-3.5" /> 添加气泡
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => setChapters((cs) => [...cs, { title: '', lines: [newLine()], price: 0 }])}
          >
            <Plus className="h-4 w-4" /> 添加章节
          </Button>
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
