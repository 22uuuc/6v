// EXPORTS: AnimePage（组件文件）
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Clapperboard } from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip, fmtCoins } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { idbGet } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AnimePage() {
  const { bookId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();

  const book = api.getBook(bookId);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    if (book) {
      idbGet(`anime:${book.id}`).then((blob) => {
        if (!alive) return;
        if (!blob) {
          setVideoUrl(null);
          setMissing(true);
          return;
        }
        setVideoUrl(URL.createObjectURL(blob));
        setMissing(false);
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  if (!book || (book.status !== 'published' && !(user && user.role === 'admin'))) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        作品不存在或未上架
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>返回</Button>
        </div>
      </div>
    );
  }

  const unlocked = user ? api.isUnlocked(user.id, book, 'visual') : book.chapterPrice <= 0;

  const pay = () => {
    if (!user) {
      toast.info('请先登录');
      navigate('/auth');
      return;
    }
    if (user.coins < book.chapterPrice) {
      toast.error('书币不足，请先充值');
      navigate('/profile');
      return;
    }
    api.unlockVisual(user.id, book);
    toast.success(`已解锁《${book.title}》（${book.chapterPrice} 书币）`);
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/book/${book.id}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> 返回详情
      </Button>

      <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-xl">
        {missing ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 text-center">
            <Clapperboard className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              片源暂未上传
              <br />
              <span className="text-xs">管理员可在后台「动漫视频上传」中补充片源</span>
            </p>
          </div>
        ) : videoUrl ? (
          <video key={videoUrl} src={videoUrl} controls autoPlay className="aspect-video w-full bg-black" />
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <p className="text-sm text-muted-foreground">正在加载片源…</p>
          </div>
        )}
      </div>

      <div>
        <h1 className="font-serif text-xl font-bold">{book.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{book.authorName} · 动漫视频</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{book.description}</p>
      </div>

      <Dialog open={!unlocked} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> 解锁动漫视频
            </DialogTitle>
            <DialogDescription>
              《{book.title}》为付费内容，解锁后可观看全部剧集。
              <br />
              全本价格：{fmtCoins(book.chapterPrice)} 书币
              {user && isVip(user) ? '（VIP 免费）' : '（开通 VIP 可免费）'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => navigate(`/book/${book.id}`)}>返回详情</Button>
            <Button onClick={pay}>立即解锁（{book.chapterPrice} 币）</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
