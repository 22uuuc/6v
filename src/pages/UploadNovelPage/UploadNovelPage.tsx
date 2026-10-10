// EXPORTS: UploadNovelPage（组件文件）
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Send, GripVertical, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { idbPut } from '@/lib/idb';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookInfoFields from '@/components/BookInfoFields';
import { EMPTY_DRAFT, type IBookDraft } from '@/lib/upload-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface IChapterDraft {
  title: string;
  content: string;
  price: number;
}

export default function UploadNovelPage() {
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
    existing && existing.type === 'novel'
      ? api.chaptersOf(existing.id).map((c) => ({ title: c.title, content: c.content, price: c.price }))
      : [{ title: '', content: '', price: 0 }],
  );

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return <p className="py-20 text-center text-sm text-muted-foreground">需要创作者身份</p>;
  }

  if (existing && existing.authorId !== user.id && user.role !== 'admin') {
    return <p className="py-20 text-center text-sm text-muted-foreground">只能编辑自己的作品</p>;
  }

  const setChapter = (i: number, patch: Partial<IChapterDraft>) =>
    setChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const submit = async (saveDraft = false) => {
    if (!draft.title.trim()) {
      toast.error('请填写书名');
      return;
    }
    const valid = chapters.filter((c) => c.title.trim() && c.content.trim());
    if (valid.length === 0) {
      toast.error('至少需要一个完整的章节（标题 + 正文）');
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
        if (draft.coverFile) {
          await idbPut(`cover:${existing.id}`, draft.coverFile);
        }
        await api.saveChapters(
          existing.id,
          valid.map((c, i) => ({ title: c.title.trim(), content: c.content.trim(), price: c.price, index: i + 1 })),
        );
        if (saveDraft) {
          toast.success('已保存到草稿箱');
        } else if (existing.status === 'published') {
          // 已上架作品被编辑：内容改动必须重新进入审核，防止绕过审核直接生效
          void api.setBookStatus(existing.id, 'pending', '', user.id);
          toast.success('内容已更新，已重新提交审核，审核通过后自动上架');
        } else {
          void api.setBookStatus(existing.id, 'pending', '', user.id);
          toast.success('已保存并提交审核');
        }
      } else {
        const book = await api.createBook({
          type: 'novel',
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
        if (draft.coverFile) {
          await idbPut(`cover:${book.id}`, draft.coverFile);
        }
        await api.saveChapters(
          book.id,
          valid.map((c, i) => ({ title: c.title.trim(), content: c.content.trim(), price: c.price, index: i + 1 })),
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
          <h1 className="font-serif text-xl font-bold">{existing ? '编辑小说' : '上传普通小说'}</h1>
          <p className="text-xs text-muted-foreground">提交后进入后台审核，审核通过即上架</p>
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
            <GripVertical className="h-4 w-4 text-muted-foreground" /> 章节（{chapters.length}）
          </h2>
          <div className="space-y-4">
            {chapters.map((ch, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">第{i + 1}章</span>
                  <Input
                    value={ch.title}
                    onChange={(e) => setChapter(i, { title: e.target.value })}
                    placeholder="章节标题"
                    className="h-8 flex-1"
                    maxLength={20}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={ch.price}
                    onChange={(e) => setChapter(i, { price: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-8 w-24"
                    placeholder="价格(币)"
                    aria-label="章节价格"
                  />
                  <Button size="icon" variant="ghost" aria-label="删除章节" onClick={() => setChapters((cs) => cs.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  value={ch.content}
                  onChange={(e) => setChapter(i, { content: e.target.value })}
                  rows={6}
                  placeholder="正文内容，空行分段……"
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => setChapters((cs) => [...cs, { title: '', content: '', price: 0 }])}
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
