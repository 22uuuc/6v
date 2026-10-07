// EXPORTS: BookInfoFields（组件文件）
import { useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ImagePlus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BookCover from '@/components/BookCover';
import { GENRES, SCENES, SCENE_NAMES, COVER_STYLES, COVER_FONTS, type BookGenre, type CoverFont } from '@/lib/types';
import type { IBookDraft } from '@/lib/upload-types';

/** 本地上传封面大小上限（8MB） */
const COVER_MAX_BYTES = 8 * 1024 * 1024;

export default function BookInfoFields({
  draft,
  onChange,
  showPrice,
  bookId,
  existingCoverType,
}: {
  draft: IBookDraft;
  onChange: (d: IBookDraft) => void;
  showPrice?: boolean;
  /** 编辑已有作品时传入作品 id（用于读回已上传的本地封面预览） */
  bookId?: string;
  /** 编辑已有作品时传入其封面来源，配合 bookId 读回预览 */
  existingCoverType?: 'svg' | 'image';
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<IBookDraft>) => onChange({ ...draft, ...patch });

  // 已选新封面图 → objectURL 即时预览；否则编辑模式读回已上传封面，新建模式走 SVG
  const coverPreviewUrl = useMemo(
    () => (draft.coverFile ? URL.createObjectURL(draft.coverFile) : null),
    [draft.coverFile],
  );
  const showExistingImage = !draft.coverFile && draft.coverType === 'image' && existingCoverType === 'image' && !!bookId;

  const pickCover = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (f.size > COVER_MAX_BYTES) {
      toast.error('封面图片请小于 8MB');
      return;
    }
    set({ coverFile: f, coverType: 'image' });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="w-32 justify-self-center sm:w-full">
          {coverPreviewUrl ? (
            <div className="relative aspect-[5/7] w-full overflow-hidden rounded-lg shadow-md shadow-black/40">
              <img src={coverPreviewUrl} alt="封面预览" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ) : (
            <BookCover
              seed={draft.coverScene}
              title={draft.title || '书名'}
              author="未署名"
              genre={draft.genre}
              style={draft.coverStyle}
              bookId={showExistingImage ? bookId : undefined}
              coverType={showExistingImage ? 'image' : 'svg'}
              font={draft.coverFont}
            />
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>书名</Label>
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="给作品起个名字" maxLength={20} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>题材</Label>
              <Select value={draft.genre} onValueChange={(v) => set({ genre: v as BookGenre })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>连载状态</Label>
              <Select value={draft.serial} onValueChange={(v) => set({ serial: v as IBookDraft['serial'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serial">连载中</SelectItem>
                  <SelectItem value="finished">已完结</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {showPrice && (
            <div className="space-y-1.5">
              <Label>全本/单话价格（书币，0 为免费）</Label>
              <Input
                type="number"
                min={0}
                max={999}
                value={draft.chapterPrice}
                onChange={(e) => set({ chapterPrice: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>本地封面（可选，上传后优先于程序化封面）</Label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {draft.coverFile ? '重新选择图片' : '上传本地封面'}
          </button>
          {draft.coverFile && (
            <button
              type="button"
              onClick={() => set({ coverFile: null, coverType: 'svg' })}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" /> 移除（恢复程序化封面）
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickCover(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <span className="text-[11px] text-muted-foreground">
            {draft.coverFile ? `已选择：${draft.coverFile.name}` : 'jpg / png / webp，≤8MB'}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>封面场景</Label>
        <div className="flex flex-wrap gap-2">
          {SCENES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set({ coverScene: s })}
              className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                draft.coverScene === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {SCENE_NAMES[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>封面风格</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COVER_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set({ coverStyle: s.value })}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                draft.coverStyle === s.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              }`}
            >
              <p className={`text-xs font-medium ${draft.coverStyle === s.value ? 'text-primary' : ''}`}>{s.label}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>书名字体（作者可自定封面书名样式）</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COVER_FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => set({ coverFont: f.value as CoverFont })}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                draft.coverFont === f.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              }`}
            >
              <p
                className={`truncate text-sm font-medium ${draft.coverFont === f.value ? 'text-primary' : ''}`}
                style={{ fontFamily: f.font }}
              >
                {f.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>标签（逗号分隔）</Label>
        <Input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="如：悬疑, 都市, 细思极恐" maxLength={40} />
      </div>

      <div className="space-y-1.5">
        <Label>作品简介</Label>
        <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={200} placeholder="一句话或一小段，让读者想点进来" />
      </div>
    </div>
  );
}
