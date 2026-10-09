// EXPORTS: CommentSection（组件文件）
// 作品评论区：读者发评/回复/点赞，作者本人或管理员可删除；内容经风险扫描。
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Send, Trash2, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import EmptyState from '@/components/EmptyState';
import type { IComment } from '@/lib/types';

export default function CommentSection({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ver = useDataVersion();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<IComment | null>(null);
  const [replyText, setReplyText] = useState('');
  void ver;

  // 渲染期直接计算：useDataVersion 版本变化即重算（见 use-data.ts 约定）
  const comments = api.commentsOf(bookId);
  const topLevel = useMemo(() => comments.filter((c) => !c.replyToId), [comments]);
  const repliesOf = (id: string) => comments.filter((c) => c.replyToId === id);

  const ensureLogin = (): boolean => {
    if (user) return true;
    toast.info('请先登录');
    navigate('/auth');
    return false;
  };

  const submit = () => {
    if (!ensureLogin() || !user) return;
    const res = api.addComment(user.id, bookId, text);
    if (!res.ok) {
      toast.error(res.msg ?? '发布失败');
      return;
    }
    setText('');
    toast.success('评论已发布');
  };

  const submitReply = (target: IComment) => {
    if (!ensureLogin() || !user) return;
    const res = api.addComment(user.id, bookId, replyText, { id: target.id, name: target.userName });
    if (!res.ok) {
      toast.error(res.msg ?? '回复失败');
      return;
    }
    setReplyText('');
    setReplyTo(null);
    toast.success('已回复');
  };

  const like = (c: IComment) => {
    if (!ensureLogin() || !user) return;
    const res = api.toggleCommentLike(user.id, c.id);
    if (res.ok) toast.success(res.liked ? '已点赞' : '已取消点赞');
    else if (res.msg) toast.error(res.msg);
  };

  const del = (c: IComment) => {
    if (!user) return;
    const res = api.deleteComment(c.id, user.id);
    if (!res.ok) toast.error(res.msg ?? '删除失败');
    else toast.success('已删除');
  };

  const canDelete = (c: IComment) => !!user && (user.role === 'admin' || user.id === c.userId);

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-medium">
        <MessageCircle className="h-4 w-4 text-primary" /> 读者评论（{comments.length}）
      </h2>

      <div className="rounded-xl border border-border bg-card p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={`聊聊《${bookTitle}》——剧情、人物、感想（最多 300 字）`}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" className="gap-1.5" onClick={submit} disabled={!text.trim()}>
            <Send className="h-3.5 w-3.5" /> 发布评论
          </Button>
        </div>
      </div>

      {comments.length === 0 ? (
        <EmptyState text="还没有评论，来抢首评" className="py-8" mood="happy" />
      ) : (
        <div className="space-y-3">
          {topLevel.map((c) => {
            const replies = repliesOf(c.id);
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
                    {c.userName.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{c.userName}</span>
                      <span>{new Date(c.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{c.content}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <button type="button" onClick={() => like(c)} className={`flex items-center gap-1 transition-colors ${user && c.likedBy.includes(user.id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                        <Heart className={`h-3.5 w-3.5 ${user && c.likedBy.includes(user.id) ? 'fill-primary' : ''}`} /> {c.likes > 0 ? c.likes : '赞'}
                      </button>
                      <button type="button" onClick={() => setReplyTo(replyTo?.id === c.id ? null : c)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
                        <CornerDownRight className="h-3.5 w-3.5" /> 回复
                      </button>
                      {canDelete(c) && (
                        <button type="button" onClick={() => del(c)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> 删除
                        </button>
                      )}
                    </div>

                    {replyTo?.id === c.id && (
                      <div className="mt-2 flex gap-2">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={2}
                          maxLength={300}
                          placeholder={`回复 ${c.userName}……`}
                          className="text-sm"
                        />
                        <Button size="sm" className="shrink-0" onClick={() => submitReply(c)} disabled={!replyText.trim()}>
                          回复
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {replies.length > 0 && (
                  <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
                    {replies.map((r) => (
                      <div key={r.id} className="rounded-lg bg-muted/40 p-2.5">
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{r.userName}</span>
                          {r.replyToName && <span className="text-muted-foreground/70">回复 @{r.replyToName}</span>}
                          <span>{new Date(r.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                        <p className="mt-1 text-sm leading-relaxed">{r.content}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs">
                          <button type="button" onClick={() => like(r)} className={`flex items-center gap-1 transition-colors ${user && r.likedBy.includes(user.id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                            <Heart className={`h-3.5 w-3.5 ${user && r.likedBy.includes(user.id) ? 'fill-primary' : ''}`} /> {r.likes > 0 ? r.likes : '赞'}
                          </button>
                          {canDelete(r) && (
                            <button type="button" onClick={() => del(r)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" /> 删除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
