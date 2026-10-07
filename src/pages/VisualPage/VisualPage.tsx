// EXPORTS: VisualPage（组件文件）
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip, fmtCoins } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import SceneArt from '@/components/SceneArt';
import { personSVG } from '@/lib/svg';
import { SCENE_NAMES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function VisualPage() {
  const { bookId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();

  const book = api.getBook(bookId);
  const script = api.visualScript(bookId);

  const [nodeId, setNodeId] = useState<string>(() => {
    if (!script) return '';
    const prog = user ? api.getProgress(user.id, bookId) : null;
    const valid = script.nodes.some((n) => n.id === prog?.nodeId);
    return valid && prog?.nodeId ? prog.nodeId : script.startNode;
  });

  useEffect(() => {
    if (!script || !nodeId) return;
    if (user) api.saveProgress(user.id, bookId, undefined, nodeId);
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  if (!book || !script || script.nodes.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        剧本不存在
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => navigate(`/book/${bookId}`)}>返回详情</Button>
        </div>
      </div>
    );
  }

  const node = script.nodes.find((n) => n.id === nodeId) ?? script.nodes[0];
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

  const restart = () => {
    setNodeId(script.startNode);
    if (user) api.saveProgress(user.id, bookId, undefined, script.startNode);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col overflow-hidden rounded-2xl border border-border">
      {/* 场景画 */}
      <div className="absolute inset-0">
        <SceneArt scene={node.scene} seed={`${bookId}-${node.id}`} variant="poster" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* 画面人物（互动角色） */}
      {node.char && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5] flex justify-center">
          <div
            className="w-36 opacity-95 drop-shadow-2xl"
            dangerouslySetInnerHTML={{ __html: personSVG(node.char, node.speaker ?? '角色', { width: 180, height: 220 }) }}
          />
        </div>
      )}

      {/* 顶栏 */}
      <div className="relative z-10 flex items-center gap-2 p-3">
        <Button variant="ghost" size="icon" className="bg-black/30 text-foreground backdrop-blur" onClick={() => navigate(`/book/${bookId}`)} aria-label="返回">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="flex-1" />
        <Badge className="bg-black/40 text-foreground backdrop-blur">{SCENE_NAMES[node.scene] ?? node.scene}</Badge>
        {node.ending && <Badge className="bg-primary text-primary-foreground">结局</Badge>}
      </div>

      {/* 剧情卡 */}
      <div className="relative z-10 mt-auto p-4 pb-6">
        <div className="rounded-2xl border border-white/10 bg-background/85 p-5 shadow-xl backdrop-blur-md">
          {node.speaker && <p className="mb-2 text-sm font-medium text-primary">{node.speaker}</p>}
          <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/90">{node.text}</p>

          <div className="mt-5 space-y-2">
            {node.choices.map((c) => (
              <Button
                key={c.label}
                variant={node.ending ? 'outline' : 'default'}
                className="w-full justify-start"
                disabled={!node.ending && !c.next}
                onClick={() => (c.next ? setNodeId(c.next) : undefined)}
              >
                {node.ending && <RotateCcw className="mr-2 h-4 w-4" />}
                {node.ending && c.label.includes('重新开始') ? '重新开始' : c.label}
              </Button>
            ))}
          </div>

          {node.ending && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              结局达成：{node.endingTitle ?? '未知结局'}
              <Button size="sm" variant="ghost" onClick={restart} className="ml-1">
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> 重来
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 付费拦截 */}
      <Dialog open={!unlocked} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> 解锁互动小说
            </DialogTitle>
            <DialogDescription>
              《{book.title}》为付费互动作品，解锁后可体验全部剧情分支与结局。
              <br />
              全本价格：{fmtCoins(book.chapterPrice)} 书币
              {user && isVip(user) ? '（VIP 免费）' : '（开通 VIP 可免费）'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => navigate(`/book/${bookId}`)}>返回详情</Button>
            <Button onClick={pay}>立即解锁（{book.chapterPrice} 币）</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
