// EXPORTS: UploadVisualPage（组件文件）
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Send, Sparkles, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { idbPut } from '@/lib/idb';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookInfoFields from '@/components/BookInfoFields';
import { EMPTY_DRAFT, type IBookDraft } from '@/lib/upload-types';
import SceneArt from '@/components/SceneArt';
import { personSVG } from '@/lib/svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SCENES, SCENE_NAMES } from '@/lib/types';

interface IChoiceDraft {
  label: string;
  next: string;
}

interface INodeDraft {
  id: string;
  scene: string;
  char: string;
  speaker: string;
  text: string;
  ending: boolean;
  endingTitle: string;
  choices: IChoiceDraft[];
}

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export default function UploadVisualPage() {
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
  const [nodes, setNodes] = useState<INodeDraft[]>(() => {
    if (existing && existing.type === 'visual') {
      const script = api.visualScript(existing.id);
      if (script) {
        return script.nodes.map((n) => ({ id: n.id, scene: n.scene, char: n.char ?? '', speaker: n.speaker ?? '', text: n.text, ending: !!n.ending, endingTitle: n.endingTitle ?? '', choices: n.choices.map((c) => ({ label: c.label, next: c.next ?? '' })) }));
      }
    }
    return [{ id: newId('n'), scene: 'sea', char: '', speaker: '', text: '', ending: false, endingTitle: '', choices: [{ label: '', next: '' }] }];
  });
  const [previewNode, setPreviewNode] = useState(0);

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return <p className="py-20 text-center text-sm text-muted-foreground">需要创作者身份</p>;
  }

  if (existing && existing.authorId !== user.id && user.role !== 'admin') {
    return <p className="py-20 text-center text-sm text-muted-foreground">只能编辑自己的作品</p>;
  }

  const setNode = (i: number, patch: Partial<INodeDraft>) =>
    setNodes((ns) => ns.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));

  const setChoice = (ni: number, ci: number, patch: Partial<IChoiceDraft>) =>
    setNodes((ns) =>
      ns.map((n, idx) =>
        idx === ni ? { ...n, choices: n.choices.map((c, cidx) => (cidx === ci ? { ...c, ...patch } : c)) } : n,
      ),
    );

  const submit = async (saveDraft = false) => {
    if (!draft.title.trim()) {
      toast.error('请填写书名');
      return;
    }
    const valid = nodes.filter((n) => n.text.trim());
    if (valid.length < 2) {
      toast.error('互动剧情至少需要两个场景节点');
      return;
    }
    const cleanNodes = valid.map((n) => ({
      id: n.id,
      scene: n.scene,
      char: n.char.trim() || undefined,
      speaker: n.speaker.trim() || undefined,
      text: n.text.trim(),
      ending: n.ending,
      endingTitle: n.ending ? n.endingTitle.trim() || '结局' : undefined,
      choices: n.choices
        .filter((c) => c.label.trim())
        .map((c) => ({ label: c.label.trim(), next: c.next || undefined })),
    }));
    const startNode = cleanNodes[0].id;
    const script = { bookId: '', startNode, nodes: cleanNodes };

    try {
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
        api.saveVisualScript(existing.id, { ...script, bookId: existing.id });
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
          type: 'visual',
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
        api.saveVisualScript(book.id, { ...script, bookId: book.id });
        toast.success(saveDraft ? '已保存到草稿箱' : '互动小说已提交，等待审核上架');
      }
      navigate('/creator');
    } catch (e) {
      // 数据层拦截（病毒载荷/脏数据）抛错时给出明确提示，且不跳转
      toast.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const currentNode = nodes[previewNode] ?? nodes[0];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creator')} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="font-serif text-xl font-bold">{existing ? '编辑互动小说' : '上传画面互动小说'}</h1>
          <p className="text-xs text-muted-foreground">每个节点 = 一个场景画面 + 一段剧情 + 一组选项</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <BookInfoFields draft={draft} onChange={setDraft} showPrice bookId={existing?.id} existingCoverType={existing?.coverType} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> 剧情节点（{nodes.length}）
            </h2>
            <div className="space-y-4">
              {nodes.map((n, i) => (
                <div key={n.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewNode(i)}
                      className={`rounded-md px-2 py-0.5 text-xs ${previewNode === i ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
                    >
                      节点 {i + 1}
                    </button>
                    <Select value={n.scene} onValueChange={(v) => setNode(i, { scene: v })}>
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCENES.map((s) => (
                          <SelectItem key={s} value={s}>{SCENE_NAMES[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={n.char}
                      onChange={(e) => setNode(i, { char: e.target.value })}
                      placeholder="画面人物（可空）"
                      className="h-7 w-28 text-xs"
                    />
                    <Input
                      value={n.speaker}
                      onChange={(e) => setNode(i, { speaker: e.target.value })}
                      placeholder="说话人（可空）"
                      className="h-7 w-24 text-xs"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={n.ending}
                        onChange={(e) => setNode(i, { ending: e.target.checked })}
                      />
                      结局节点
                    </label>
                    {n.ending && (
                      <Input
                        value={n.endingTitle}
                        onChange={(e) => setNode(i, { endingTitle: e.target.value })}
                        placeholder="结局名，如：重逢"
                        className="h-7 w-24 text-xs"
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto h-7 w-7"
                      aria-label="删除节点"
                      onClick={() => {
                        setNodes((ns) => ns.filter((_, idx) => idx !== i));
                        if (previewNode >= i) setPreviewNode(Math.max(0, previewNode - 1));
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea
                    value={n.text}
                    onChange={(e) => setNode(i, { text: e.target.value })}
                    rows={3}
                    placeholder="这段剧情的文字……"
                  />
                  {!n.ending && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-muted-foreground">选项（留空 next 则停在当前节点）</p>
                      {n.choices.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          <Input
                            value={c.label}
                            onChange={(e) => setChoice(i, ci, { label: e.target.value })}
                            placeholder="选项文字，如：走过去"
                            className="h-8 flex-1 text-xs"
                          />
                          <Select value={c.next} onValueChange={(v) => setChoice(i, ci, { next: v })}>
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue placeholder="跳转节点" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">不跳转</SelectItem>
                              {nodes.map((nn, ni) => (
                                <SelectItem key={nn.id} value={nn.id}>
                                  节点 {ni + 1}{nn.ending ? '（结局）' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="删除选项"
                            onClick={() =>
                              setNodes((ns) =>
                                ns.map((x, xi) => (xi === i ? { ...x, choices: x.choices.filter((_, ci2) => ci2 !== ci) } : x)),
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          setNodes((ns) =>
                            ns.map((x, xi) => (xi === i ? { ...x, choices: [...x.choices, { label: '', next: '' }] } : x)),
                          )
                        }
                      >
                        <Plus className="h-3.5 w-3.5" /> 添加选项
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() =>
                setNodes((ns) => [...ns, { id: newId('n'), scene: 'street', char: '', speaker: '', text: '', ending: false, endingTitle: '', choices: [{ label: '', next: '' }] }])
              }
            >
              <Plus className="h-4 w-4" /> 添加节点
            </Button>
          </CardContent>
        </Card>

        {/* 实时预览 */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> 当前节点预览
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="relative aspect-[3/4]">
                <SceneArt scene={currentNode.scene} seed={`preview-${currentNode.id}`} variant="poster" />
                <div className="absolute inset-x-0 bottom-0 bg-background/90 p-2.5 backdrop-blur">
                  {currentNode.speaker && <p className="text-[11px] font-medium text-primary">{currentNode.speaker}</p>}
                  <p className="line-clamp-3 text-xs leading-5 text-foreground/90">{currentNode.text || '（这段还没有剧情文字）'}</p>
                  {currentNode.ending && <p className="mt-1 text-[10px] text-primary">结局：{currentNode.endingTitle || '未命名'}</p>}
                </div>
                {(currentNode.char || currentNode.speaker) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
                    <div
                      className="w-28 aspect-[2/3]"
                      dangerouslySetInnerHTML={{ __html: personSVG(currentNode.char || currentNode.speaker || '角色', currentNode.speaker || currentNode.char || '角色', { poster: true }) }}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
