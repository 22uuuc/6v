// EXPORTS: AdminService（用户服务：意见反馈 + 客服信箱）
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MessageSquareText, Headset, CheckCircle2, Clock3, Send, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDataVersion } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { IFeedback } from '@/lib/types';

const TYPE_LABEL: Record<IFeedback['type'], string> = {
  suggest: '功能建议', bug: 'Bug 反馈', report: '内容举报', other: '其他',
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AdminService() {
  const { user } = useAuth();
  useDataVersion();
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [selectedUser, setSelectedUser] = useState('');
  const [adminDraft, setAdminDraft] = useState('');

  const feedbacks = useMemo(() => (user ? api.adminFeedback() : []), [user]);
  const messages = useMemo(() => (user ? api.adminMessages() : []), [user]);

  const unreadByUser = useMemo(() => {
    const m = new Map<string, number>();
    messages.forEach((x) => {
      if (x.sender === 'user' && !x.read) m.set(x.userId, (m.get(x.userId) ?? 0) + 1);
    });
    return m;
  }, [messages]);

  const convoUsers = useMemo(() => {
    const map = new Map<string, { name: string; last: string }>();
    messages.forEach((m) => {
      map.set(m.userId, { name: m.userName, last: m.createdAt });
    });
    return [...map.entries()].sort((a, b) => (a[1].last < b[1].last ? 1 : -1));
  }, [messages]);

  const convo = useMemo(() => messages.filter((m) => m.userId === selectedUser), [messages, selectedUser]);

  if (!user || user.role !== 'admin') return null;

  const replyFeedback = (id: string) => {
    const text = replyDraft[id] ?? '';
    const res = api.replyFeedback(id, text, user.id);
    if (!res.ok) {
      toast.error(res.msg ?? '回复失败');
      return;
    }
    toast.success('已回复并标记为已处理');
    setReplyDraft((p) => ({ ...p, [id]: '' }));
  };

  const sendAdminReply = () => {
    if (!selectedUser || !adminDraft.trim()) return;
    const res = api.adminReply(selectedUser, adminDraft, user.id);
    if (!res.ok) {
      toast.error(res.msg ?? '发送失败');
      return;
    }
    toast.success('已回复用户');
    setAdminDraft('');
  };

  return (
    <div className="space-y-6">
      {/* 意见反馈工单 */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-primary" />
          <h2 className="font-medium">意见反馈工单（{feedbacks.length}）</h2>
        </div>
        {feedbacks.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无反馈</p>}
        <div className="space-y-3">
          {feedbacks
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .map((f) => (
              <Card key={f.id}>
                <CardContent className="p-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{TYPE_LABEL[f.type]}</Badge>
                    {f.status === 'pending' ? (
                      <Badge className="gap-1 bg-amber-500/15 text-amber-600">
                        <Clock3 className="h-3 w-3" /> 待处理
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> 已处理
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{f.userName} · {fmtTime(f.createdAt)}</span>
                  </div>
                  <p className="font-medium">{f.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.content}</p>
                  {f.contact && <p className="mt-1 text-xs text-muted-foreground/80">联系方式：{f.contact}</p>}
                  {f.reply && (
                    <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-sm">
                      <span className="font-medium text-primary">已回复：</span>{f.reply}
                    </p>
                  )}
                  {f.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <Input
                        placeholder="输入处理意见 / 回复内容"
                        value={replyDraft[f.id] ?? ''}
                        onChange={(e) => setReplyDraft((p) => ({ ...p, [f.id]: e.target.value }))}
                        maxLength={200}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => replyFeedback(f.id)} disabled={!(replyDraft[f.id] ?? '').trim()} className="gap-1.5">
                        <Send className="h-3.5 w-3.5" /> 回复并处理
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {/* 客服信箱 */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Headset className="h-4 w-4 text-primary" />
          <h2 className="font-medium">客服信箱（{convoUsers.length} 个会话）</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1.5">
            {convoUsers.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">暂无会话</p>}
            {convoUsers.map(([userId, info]) => (
              <button
                key={userId}
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  selectedUser === userId ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                }`}
                onClick={() => {
                  setSelectedUser(userId);
                  api.markSupportRead();
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {info.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{info.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{fmtTime(info.last)}</span>
                </span>
                {(unreadByUser.get(userId) ?? 0) > 0 && (
                  <Badge className="h-5 min-w-5 justify-center px-1.5">{unreadByUser.get(userId)}</Badge>
                )}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="flex h-[420px] flex-col p-0">
              {selectedUser ? (
                <>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {convo.map((m) => (
                      <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                            m.sender === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border border-border bg-muted/60'
                          }`}
                        >
                          <p className="mb-0.5 text-[10px] opacity-60">{m.sender === 'user' ? m.userName : '客服（管理员）'}</p>
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="mt-1 text-right text-[10px] opacity-50">{fmtTime(m.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-2 border-t p-3">
                    <Input
                      placeholder="回复该用户…"
                      value={adminDraft}
                      onChange={(e) => setAdminDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendAdminReply()}
                      maxLength={500}
                      className="flex-1"
                    />
                    <Button onClick={sendAdminReply} disabled={!adminDraft.trim()} className="shrink-0 gap-1.5">
                      <Send className="h-4 w-4" /> 发送
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <Lock className="h-8 w-8 opacity-40" />
                  <p>选择左侧会话查看读者消息</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
