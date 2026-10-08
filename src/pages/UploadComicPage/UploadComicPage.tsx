// EXPORTS: UploadComicPage（组件文件）
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Send, ImagePlus, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookInfoFields from '@/components/BookInfoFields';
import { EMPTY_DRAFT, type IBookDraft } from '@/lib/upload-types';
import { idbPut, idbGet, idbDel } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SCENES, SCENE_NAMES } from '@/lib/types';

interface IPageDraft {
  scene: string;
  imageKey?: string;
  caption: string;
  dialogue: string;
}

interface IComicChapterDraft {
  title: string;
  price: number;
  pages: IPageDraft[];
}

/** 页内图片预览：从 IndexedDB 读取已上传图片 */
function PageImagePreview({ imageKey }: { imageKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    idbGet(imageKey).then((blob) => {
      if (alive && blob) setUrl(URL.createObjectURL(blob));
    });
    return () => {
      alive = false;
    };
  }, [imageKey]);
  if (!url) return null;
  return <img src={url} alt="" className="h-16 w-12 rounded-md border border-border object-cover" />;
}

export default function UploadComicPage() {
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
  const [draftKey] = useState(() => (existing ? existing.id : `draft-${Date.now()}`));
  const [chapters, setChapters] = useState<IComicChapterDraft[]>(() => {
    if (existing && existing.type === 'comic') {
      return api.comicChapters(existing.id).map((c) => ({
        title: c.title,
        price: c.price,
        pages: api.comicPages(c.id).map((p) => ({ scene: p.scene, imageKey: p.imageKey, caption: p.caption ?? '', dialogue: p.dialogue.join('\n') })),
      }));
    }
    return [{ title: '', price: 0, pages: [{ scene: 'street', caption: '', dialogue: '' }] }];
  });

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return <p className="py-20 text-center text-sm text-muted-foreground">需要创作者身份</p>;
  }

  if (existing && existing.authorId !== user.id && user.role !== 'admin') {
    return <p className="py-20 text-center text-sm text-muted-foreground">只能编辑自己的作品</p>;
  }

  const setChapter = (i: number, patch: Partial<IComicChapterDraft>) =>
    setChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const setPage = (ci: number, pi: number, patch: Partial<IPageDraft>) =>
    setChapters((cs) =>
      cs.map((c, cidx) =>
        cidx === ci ? { ...c, pages: c.pages.map((p, pidx) => (pidx === pi ? { ...p, ...patch } : p)) } : c,
      ),
    );

  /** 页面图片上传：存 IndexedDB，键含章/页序号（新建作品用草稿键，保存时迁移） */
  const uploadPageImage = async (ci: number, pi: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('单张图片请小于 8MB');
      return;
    }
    const tmpKey = `comic:${draftKey}:${ci + 1}:p${pi + 1}`;
    await idbPut(tmpKey, file);
    setPage(ci, pi, { imageKey: tmpKey });
    toast.success('图片已上传，保存后进入审核');
  };

  const removePageImage = async (ci: number, pi: number) => {
    const p = chapters[ci]?.pages[pi];
    if (p?.imageKey) await idbDel(p.imageKey);
    setPage(ci, pi, { imageKey: undefined });
  };

  const submit = async (saveDraft = false) => {
    if (!draft.title.trim()) {
      toast.error('请填写书名');
      return;
    }
    const valid = chapters.filter((c) => c.title.trim() && c.pages.some((p) => p.dialogue.trim() || p.imageKey));
    if (valid.length === 0) {
      toast.error('至少需要一个完整的话（标题 + 一页含对白或图片）');
      return;
    }
    const clean = valid.map((c) => ({
      title: c.title.trim(),
      price: c.price,
      pages: c.pages
        .filter((p) => p.dialogue.trim() || p.caption.trim() || p.imageKey)
        .map((p) => ({
          scene: p.scene,
          imageKey: p.imageKey,
          caption: p.caption.trim() || undefined,
          dialogue: p.dialogue.split('\n').map((d) => d.trim()).filter(Boolean),
        })),
    }));

    let bookId = existing?.id ?? '';
    if (existing) {
      api.updateBook(existing.id, {
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
      await api.saveComic(existing.id, clean);
      if (saveDraft) {
        toast.success('已保存到草稿箱');
      } else if (existing.status === 'published') {
        api.setBookStatus(existing.id, 'pending', '', user.id);
        toast.success('内容已更新，已重新提交审核，审核通过后自动上架');
      } else {
        api.setBookStatus(existing.id, 'pending', '', user.id);
        toast.success('已保存并提交审核');
      }
    } else {
      const book = api.createBook({
        type: 'comic',
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
      bookId = book.id;
      if (draft.coverFile) {
        await idbPut(`cover:${book.id}`, draft.coverFile);
      }
      // 迁移草稿图片到正式键
      for (let ci = 0; ci < clean.length; ci++) {
        for (let pi = 0; pi < clean[ci].pages.length; pi++) {
          const oldKey = `comic:${draftKey}:${ci + 1}:p${pi + 1}`;
          const blob = await idbGet(oldKey);
          if (blob) {
            const newKey = `comic:${bookId}:${ci + 1}:p${pi + 1}`;
            await idbPut(newKey, blob);
            await idbDel(oldKey);
            clean[ci].pages[pi] = { ...clean[ci].pages[pi], imageKey: newKey };
          }
        }
      }
      await api.saveComic(book.id, clean);
      toast.success(saveDraft ? '已保存到草稿箱' : '漫画已提交，等待审核上架');
    }
    navigate('/creator');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creator')} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="font-serif text-xl font-bold">{existing ? '编辑漫画' : '上传漫画'}</h1>
          <p className="text-xs text-muted-foreground">每页可选「上传图片」或「程序化场景」，旁白 + 对白（每行一句气泡）</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <BookInfoFields draft={draft} onChange={setDraft} showPrice bookId={existing?.id} existingCoverType={existing?.coverType} />
        </CardContent>
      </Card>

      {chapters.map((ch, ci) => (
        <Card key={ci}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">第{ci + 1}话</span>
              <Input
                value={ch.title}
                onChange={(e) => setChapter(ci, { title: e.target.value })}
                placeholder="话标题"
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
                aria-label="话价格"
              />
              <Button size="icon" variant="ghost" aria-label="删除话" onClick={() => setChapters((cs) => cs.filter((_, idx) => idx !== ci))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-3">
              {ch.pages.map((p, pi) => (
                <div key={pi} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-2 sm:w-56">
                    <span className="shrink-0 text-xs text-muted-foreground">P{pi + 1}</span>
                    {p.imageKey ? (
                      <div className="flex items-center gap-1.5">
                        <PageImagePreview imageKey={p.imageKey} />
                        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="移除图片" onClick={() => removePageImage(ci, pi)}>
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:border-primary/60">
                        <ImagePlus className="h-3.5 w-3.5" /> 传图
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadPageImage(ci, pi, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    <Select value={p.scene} onValueChange={(v) => setPage(ci, pi, { scene: v })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCENES.map((s) => (
                          <SelectItem key={s} value={s}>{SCENE_NAMES[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr]">
                    <Input
                      value={p.caption}
                      onChange={(e) => setPage(ci, pi, { caption: e.target.value })}
                      placeholder="旁白（可空）"
                      className="h-8 text-xs"
                    />
                    <Textarea
                      value={p.dialogue}
                      onChange={(e) => setPage(ci, pi, { dialogue: e.target.value })}
                      rows={2}
                      placeholder={'对白，每行一句气泡，如：\n小满：再睡五分钟……\n猫：喵'}
                      className="text-xs"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="删除页面"
                    onClick={() => setChapters((cs) => cs.map((c, cidx) => (cidx === ci ? { ...c, pages: c.pages.filter((_, pidx) => pidx !== pi) } : c)))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => setChapters((cs) => cs.map((c, cidx) => (cidx === ci ? { ...c, pages: [...c.pages, { scene: 'street', caption: '', dialogue: '' }] } : c)))}
            >
              <Plus className="h-4 w-4" /> 添加一页
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setChapters((cs) => [...cs, { title: '', price: 0, pages: [{ scene: 'street', caption: '', dialogue: '' }] }])}
        >
          <Plus className="h-4 w-4" /> 添加新话
        </Button>
        <Button variant="outline" className="ml-auto gap-1.5" onClick={() => navigate('/creator')}>
          取消返回
        </Button>
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
