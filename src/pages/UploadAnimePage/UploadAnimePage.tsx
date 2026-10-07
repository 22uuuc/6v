// EXPORTS: UploadAnimePage（组件文件，仅管理员可访问）
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clapperboard, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookInfoFields from '@/components/BookInfoFields';
import { EMPTY_DRAFT, type IBookDraft } from '@/lib/upload-types';
import { idbPut } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function UploadAnimePage() {
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
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || user.role !== 'admin') {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-primary" />
        动漫视频上传权限仅限管理员
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => navigate('/creator')}>返回创作中心</Button>
        </div>
      </div>
    );
  }

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('请选择视频文件（mp4 / webm）');
      return;
    }
    // 不设大小上限：视频体积由浏览器 IndexedDB 存储配额承载，超出配额时浏览器会自行报错
    setVideo(f);
    setVideoUrl(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!draft.title.trim()) {
      toast.error('请填写作品名');
      return;
    }
    if (!video) {
      toast.error('请选择视频文件');
      return;
    }
    setBusy(true);
    try {
      if (existing && existing.type === 'anime') {
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
        await idbPut(`anime:${existing.id}`, video);
        toast.success('片源已更新，直接上架');
      } else {
        const book = api.createBook({
          type: 'anime',
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
          status: 'published',
        });
        if (draft.coverFile) {
          await idbPut(`cover:${book.id}`, draft.coverFile);
        }
        await idbPut(`anime:${book.id}`, video);
        toast.success('动漫视频已上架');
      }
      navigate('/creator');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/creator')} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h1 className="font-serif text-xl font-bold">{existing ? '更新动漫片源' : '上传动漫视频'}</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> 仅管理员权限 · 上传后直接上架
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <BookInfoFields draft={draft} onChange={setDraft} showPrice bookId={existing?.id} existingCoverType={existing?.coverType} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <Clapperboard className="h-4 w-4 text-primary" /> 视频片源
          </h2>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-center transition-colors hover:border-primary/60">
            <Clapperboard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">点击选择视频文件（mp4 / webm，不设大小上限）</p>
            <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          {videoUrl && (
            <div className="mt-3">
              <video src={videoUrl} controls className="aspect-video w-full rounded-lg border border-border bg-black" />
              <p className="mt-1 text-xs text-muted-foreground">{video?.name}（{video ? Math.round(video.size / 1024 / 1024) : 0}MB）</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => navigate('/creator')}>取消返回</Button>
        <Button onClick={submit} disabled={busy} className="gap-1.5">
          <Send className="h-4 w-4" /> {existing ? '更新片源' : '上传并上架'}
        </Button>
      </div>
    </div>
  );
}
