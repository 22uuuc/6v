// EXPORTS: SupportPage（联系客服 · 站内会话）
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Headset, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDataVersion } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import type { IMessage } from '@/lib/types';

export default function SupportPage() {
  const { user } = useAuth();
  useDataVersion();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const list = useMemo<IMessage[]>(() => (user ? api.myMessages(user.id) : []), [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="mb-4 text-muted-foreground">登录后才能联系客服</p>
        <Button onClick={() => navigate('/auth')}>去登录</Button>
      </div>
    );
  }

  const send = () => {
    if (!text.trim()) return;
    const res = api.sendMessage(user.id, text);
    if (!res.ok) {
      toast.error(res.msg ?? '发送失败');
      return;
    }
    setText('');
  };

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Headset className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-serif text-lg font-bold">联系客服</h1>
          <p className="text-xs text-muted-foreground">客服在线时间 9:00-22:00 · 消息会尽快回复</p>
        </div>
      </div>

      <Card className="flex h-[480px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {list.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Headset className="h-8 w-8 opacity-40" />
              <p>有什么可以帮你的？直接发消息给客服吧</p>
            </div>
          )}
          {list.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  m.sender === 'user'
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm border border-border bg-muted/60'
                }`}
              >
                <p className="mb-0.5 text-[10px] opacity-60">{m.sender === 'user' ? '我' : '客服'}</p>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className="mt-1 text-right text-[10px] opacity-50">{new Date(m.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            placeholder="输入消息，按发送键提交（最长 500 字）"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            className="flex-1"
          />
          <Button onClick={send} disabled={!text.trim()} className="shrink-0 gap-1.5">
            <Send className="h-4 w-4" /> 发送
          </Button>
        </div>
      </Card>
    </div>
  );
}
