// EXPORTS: AdminBooks（组件文件）
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Eye, ArrowUpDown, Star, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话小说', game: '游戏' };

export default function AdminBooks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useDataVersion();
  const books = api.allBooks();
  const pending = useMemo(() => books.filter((b) => b.status === 'pending'), [books]);
  const managed = useMemo(() => books.filter((b) => b.status !== 'pending'), [books]);

  const [rejectBook, setRejectBook] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState('');
  const [quarantineBook, setQuarantineBook] = useState<{ id: string; title: string } | null>(null);

  const doReject = () => {
    if (rejectBook && user) {
      api.setBookStatus(rejectBook.id, 'rejected', reason.trim() || '内容待修改', user.id);
      toast.success(`已驳回《${rejectBook.title}》`);
    }
    setRejectBook(null);
    setReason('');
  };

  const doQuarantine = () => {
    if (quarantineBook && user) {
      api.quarantine(quarantineBook.id, user.id);
      toast.success(`已隔离《${quarantineBook.title}》：下架并清除危险内容，作者已封禁`);
    }
    setQuarantineBook(null);
  };

  return (<div className="page-enter space-y-6">
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-medium">
          待审核（{pending.length}）
          <span className="text-xs font-normal text-muted-foreground">创作者提交的作品在此审核</span>
        </h3>
        {pending.length === 0 ? (
          <EmptyState text="没有待审核的作品" className="py-8" />
        ) : (
          <div className="space-y-2">
            {pending.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="w-11 shrink-0">
                  <BookCover seed={b.coverSeed} title={b.title} author={b.authorName} genre={b.genre} style={b.coverStyle} bookId={b.id} coverType={b.coverType} font={b.coverFont}  type={b.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{b.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[b.type]}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {b.authorName} · {b.genre} · {b.chapterIds.length} 个章节
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="icon" variant="ghost" aria-label="预览" onClick={() => navigate(`/book/${b.id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setRejectBook({ id: b.id, title: b.title })}>
                    <X className="h-3.5 w-3.5" /> 驳回
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => { if (user) { api.setBookStatus(b.id, 'published', '', user.id); toast.success(`《${b.title}》已上架`); } }}>
                    <Check className="h-3.5 w-3.5" /> 通过
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-medium">
          已上架 / 已下架（{managed.length}）
          <span className="text-xs font-normal text-muted-foreground">可推流量（编辑推荐）、下架违规、隔离危险内容</span>
        </h3>
        <div className="space-y-2">
          {managed.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="w-11 shrink-0">
                <BookCover seed={b.coverSeed} title={b.title} author={b.authorName} genre={b.genre} style={b.coverStyle} bookId={b.id} coverType={b.coverType} font={b.coverFont}  type={b.type} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{b.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[b.type]}</Badge>
                  {b.featured && <Badge className="gap-1 text-[10px]"><Star className="h-2.5 w-2.5 fill-current" /> 推荐</Badge>}
                  {b.quarantined && <Badge variant="outline" className="text-[10px] text-destructive">已隔离</Badge>}
                  <Badge variant={b.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                    {b.status === 'published' ? '已上架' : '已下架'}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {b.authorName} · {b.genre} · {b.views} 阅读 · {b.likes} 收藏
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={b.featured ? 'default' : 'outline'}
                  className="gap-1"
                  onClick={() => {
                    if (user) {
                      api.setFeatured(b.id, !b.featured, user.id);
                      toast.success(b.featured ? `已取消《${b.title}》推荐` : `已为《${b.title}》推送编辑推荐流量`);
                    }
                  }}
                >
                  <Star className={`h-3.5 w-3.5 ${b.featured ? 'fill-current' : ''}`} />
                  {b.featured ? '取消推荐' : '推流量'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  onClick={() => {
                    if (!user) return;
                    if (b.status === 'published') {
                      api.setBookStatus(b.id, 'offline', '', user.id);
                      toast.success(`《${b.title}》已下架`);
                    } else {
                      api.setBookStatus(b.id, 'pending', '', user.id);
                      toast.success(`《${b.title}》已重新提交审核`);
                    }
                  }}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {b.status === 'published' ? '下架' : '重新上架'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-destructive"
                  onClick={() => setQuarantineBook({ id: b.id, title: b.title })}
                >
                  <ShieldAlert className="h-3.5 w-3.5" /> 隔离
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={!!rejectBook} onOpenChange={(o) => !o && setRejectBook(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>驳回《{rejectBook?.title}》</DialogTitle>
            <DialogDescription>填写驳回原因，创作者可在创作中心看到</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>驳回原因</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：正文与简介不符" maxLength={40} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectBook(null)}>取消</Button>
            <Button variant="destructive" onClick={doReject}>确认驳回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quarantineBook} onOpenChange={(o) => !o && setQuarantineBook(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" /> 隔离《{quarantineBook?.title}》？
            </DialogTitle>
            <DialogDescription>
              将下架该作品、清除全部章节与剧本内容、封禁作者账号，并标记相关安全日志为已查杀。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuarantineBook(null)}>取消</Button>
            <Button variant="destructive" onClick={doQuarantine}>确认隔离</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
