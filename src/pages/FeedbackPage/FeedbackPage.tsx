// EXPORTS: FeedbackPage（意见反馈）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageSquarePlus, CheckCircle2, Clock3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { IFeedback } from '@/lib/types';

const TYPES: { value: IFeedback['type']; label: string }[] = [
  { value: 'suggest', label: '功能建议' },
  { value: 'bug', label: 'Bug 反馈' },
  { value: 'report', label: '内容举报' },
  { value: 'refund', label: '退款申请' },
  { value: 'other', label: '其他' },
];

const TYPE_LABEL: Record<IFeedback['type'], string> = {
  suggest: '功能建议', bug: 'Bug 反馈', report: '内容举报', refund: '退款申请', other: '其他',
};

export default function FeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<IFeedback['type']>('suggest');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [list, setList] = useState<IFeedback[]>(() => (user ? api.myFeedback(user.id) : []));

  if (!user) {
    return (<div className="page-enter mx-auto max-w-md py-16 text-center">
        <p className="mb-4 text-muted-foreground">登录后才能提交意见反馈</p>
        <Button onClick={() => navigate('/auth')}>去登录</Button>
      </div>
    );
  }

  const submit = () => {
    const res = api.submitFeedback(user.id, { type, title, content, contact });
    if (!res.ok) {
      toast.error(res.msg ?? '提交失败');
      return;
    }
    toast.success('反馈已提交，管理员会尽快处理');
    setTitle('');
    setContent('');
    setContact('');
    setList(api.myFeedback(user.id));
  };

  return (<div className="page-enter mx-auto max-w-lg space-y-5 py-6">
      <div>
        <h1 className="font-serif text-xl font-bold">意见反馈</h1>
        <p className="text-sm text-muted-foreground">功能建议、问题反馈、内容举报，都可以告诉我们</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-4 w-4 text-primary" /> 提交反馈
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 hover:border-primary/50'}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>标题</Label>
            <Input placeholder="一句话概括你的反馈" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label>详细内容</Label>
            <Textarea placeholder="尽量描述清楚：发生了什么 / 想要什么 / 怎么复现" value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label>联系方式（选填）</Label>
            <Input placeholder="邮箱 / 手机号，便于我们回访" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={40} />
          </div>
          <Button className="w-full" onClick={submit} disabled={!title.trim() || !content.trim()}>
            提交反馈
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">我的反馈（{list.length}）</h2>
        {list.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">还没有提交过反馈</p>}
        <div className="space-y-3">
          {list.map((f) => (
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
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="font-medium">{f.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.content}</p>
                {f.refund && (
                  <div className={`mt-3 rounded-lg border p-3 text-sm ${f.refund.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5' : f.refund.status === 'rejected' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">退款进度</p>
                    <p className="text-sm">
                      退款单 {f.refund.txId} · {f.refund.yuan} 元（{f.refund.coin} 币）：
                      {f.refund.status === 'none' && <span className="text-amber-600">等待管理员审核</span>}
                      {f.refund.status === 'approved' && <span className="text-emerald-600">已审核通过，书币已原路退回余额</span>}
                      {f.refund.status === 'rejected' && <span className="text-destructive">已被管理员驳回</span>}
                    </p>
                  </div>
                )}
                {f.reply && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-primary">管理员回复（{f.replyAt ? new Date(f.replyAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}）</p>
                    {f.reply}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
