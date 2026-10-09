// EXPORTS: CreatorPage（组件文件）
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Plus, PenLine, MessageSquareText, Images, Landmark, Eye, Heart,
  ArrowUpRight, Trash2, PencilLine, Clapperboard, BadgeCheck, Clock3,
  MessagesSquare, Gamepad2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, fmtYuan } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import BookCover from '@/components/BookCover';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { IBook, BookType } from '@/lib/types';

const STATUS_META: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending: { label: '待审核', variant: 'outline' },
  published: { label: '已上架', variant: 'default' },
  rejected: { label: '已驳回', variant: 'outline' },
  offline: { label: '已下架', variant: 'secondary' },
};

const TYPE_LABEL: Record<string, string> = { novel: '小说', visual: '互动IP', comic: '漫画', anime: '动漫', dialogue: '对话小说', game: '游戏' };

function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'MM-dd HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
}

export default function CreatorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDataVersion();
  const [toDelete, setToDelete] = useState<IBook | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [workType, setWorkType] = useState<BookType>('novel');
  const [workIntro, setWorkIntro] = useState('');

  const books = useMemo(() => (user ? api.creatorBooks(user.id) : []), [user]);
  const stats = useMemo(
    () => (user ? api.creatorStats(user.id) : { income: 0, pending: 0, books: 0, fans: 0, views: 0, drafts: 0, pendingCount: 0 }),
    [user],
  );
  const incomeTrend = useMemo(() => (user ? api.creatorIncomeTrend(user.id, 7) : []), [user]);
  const rewards = useMemo(() => (user ? api.txsOf(user.id).filter((t) => t.kind === 'reward').slice(0, 6) : []), [user]);
  const application = useMemo(() => (user ? api.myApplication(user.id) : null), [user]);
  const trendMax = useMemo(() => Math.max(1, ...incomeTrend.map((d) => d.amount)), [incomeTrend]);

  const submitApply = () => {
    if (!user) return;
    const res = api.applyCreator(user.id, { reason, workTitle, workType, workIntro });
    if (!res.ok) {
      toast.error(res.msg ?? '申请失败');
      return;
    }
    setApplyOpen(false);
    setReason('');
    setWorkTitle('');
    setWorkIntro('');
    toast.success('资质申请已提交，请等待管理员审核');
  };

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return (
      <div className="py-20">
        {!user ? (
          <>
            <EmptyState text="请先登录后申请开通创作者" />
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => navigate('/auth')}>去登录 / 注册</Button>
            </div>
          </>
        ) : application?.status === 'pending' ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="space-y-3 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Clock3 className="h-6 w-6" />
              </span>
              <h1 className="font-serif text-lg font-bold">创作者资质审核中</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                已提交资质说明与首部作品《{application.workTitle}》（{TYPE_LABEL[application.workType]}）。
                管理员审核通过后将自动开通创作者身份，作品进入上架审核。
              </p>
              <p className="text-xs text-muted-foreground">提交时间：{fmtTime(application.createdAt)}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <EmptyState
              text={
                application?.status === 'rejected'
                  ? `创作者资质申请被驳回：${application.note ?? '未通过'}`
                  : '申请开通创作者需通过资质审核，并随申请提交首部作品初步发布'
              }
            />
            <div className="flex justify-center">
              <Button className="gap-1.5" onClick={() => setApplyOpen(true)}>
                <PenLine className="h-4 w-4" /> {application ? '重新申请开通创作者' : '申请成为创作者'}
              </Button>
            </div>
          </>
        )}

        <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>申请开通创作者</DialogTitle>
              <DialogDescription>
                填写资质说明并提交首部作品初步发布。管理员审核通过后开通创作者身份，作品进入上架审核。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>资质说明（创作经验 / 擅长方向 / 简介）</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例如：写作两年，擅长悬疑与都市题材，曾连载过 20 万字作品"
                  maxLength={300}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>首部作品名称</Label>
                <Input value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="作品名（审核通过后自动生成待审作品）" maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <Label>作品类型</Label>
                <Select value={workType} onValueChange={(v) => setWorkType(v as BookType)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择类型" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novel">小说</SelectItem>
                    <SelectItem value="visual">互动IP</SelectItem>
                    <SelectItem value="dialogue">对话小说</SelectItem>
                    <SelectItem value="comic">漫画</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>作品简介（初步发布信息）</Label>
                <Textarea
                  value={workIntro}
                  onChange={(e) => setWorkIntro(e.target.value)}
                  placeholder="一两句话介绍你的作品"
                  maxLength={200}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyOpen(false)}>取消</Button>
              <Button className="gap-1.5" onClick={submitApply} disabled={!reason.trim() || !workTitle.trim() || !workIntro.trim()}>
                <BadgeCheck className="h-4 w-4" /> 提交资质申请
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const uploadEntries = [
    { to: '/creator/upload-novel', icon: PenLine, label: '上传小说', desc: '章节文字，连载或完结' },
    { to: '/creator/upload-visual', icon: MessageSquareText, label: '上传互动IP', desc: '场景 + 分支 + 多结局' },
    { to: '/creator/upload-dialogue', icon: MessagesSquare, label: '上传对话小说', desc: '聊天气泡推进剧情' },
    { to: '/creator/upload-game', icon: Gamepad2, label: '游戏上架', desc: '选试玩模板，读者直接开玩' },
    { to: '/creator/upload-comic', icon: Images, label: '上传漫画', desc: '分镜页面，一话一话' },
    ...(user.role === 'admin' ? [{ to: '/creator/upload-anime', icon: Clapperboard, label: '上传动漫视频', desc: '管理员专属，上传直接上架' }] : []),
  ];

  const statusBtn = (book: IBook) => {
    if (book.status === 'draft' || book.status === 'rejected' || book.status === 'offline') {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            api.setBookStatus(book.id, 'pending', '', user.id);
            toast.success('已提交审核');
          }}
        >
          申请上架
        </Button>
      );
    }
    if (book.status === 'published') {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            api.setBookStatus(book.id, 'offline', '', user.id);
            toast.success('已下架');
          }}
        >
          下架
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">创作者中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">上传作品，作品上架后读者订阅与打赏都会变成你的收益</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/creator/earnings')} className="gap-1.5">
          <Landmark className="h-4 w-4" /> 收益中心
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">数据总览</TabsTrigger>
          <TabsTrigger value="books">作品管理（{books.length}）</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">累计收益</p>
                <p className="mt-1 text-xl font-bold text-primary">{fmtYuan(stats.income)} 元</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">可提现</p>
                <p className="mt-1 text-xl font-bold">{fmtYuan(stats.pending)} 元</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">作品数</p>
                <p className="mt-1 text-xl font-bold">{stats.books}</p>
                {stats.drafts > 0 && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">另有 {stats.drafts} 份草稿</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">总阅读量</p>
                <p className="mt-1 text-xl font-bold">{stats.views.toLocaleString('zh-CN')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">累计收藏</p>
                <p className="mt-1 text-xl font-bold">{stats.fans}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">待审核作品</p>
                <p className="mt-1 text-xl font-bold text-amber-500">{stats.pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          {incomeTrend.some((d) => d.amount > 0) ? (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-medium">近 7 日收益（已结算）</h2>
                  <span className="text-[11px] text-muted-foreground">单位：书币</span>
                </div>
                <div className="flex h-32 items-end gap-2">
                  {incomeTrend.map((d) => (
                    <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-primary/70 to-primary/40 transition-colors group-hover:from-primary group-hover:to-primary/60"
                        style={{ height: `${Math.max(6, Math.round((d.amount / trendMax) * 100))}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{d.label}</span>
                      <span className="absolute -top-6 hidden rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-primary shadow group-hover:block">
                        {d.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 font-medium">近 7 日收益（已结算）</h2>
                <EmptyState text="最近 7 天还没有已结算的收益，作品上架后订阅与打赏会出现在这里" className="py-6" />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {uploadEntries.map((e) => (
              <Card key={e.to} className="cursor-pointer transition-colors hover:border-primary/60" onClick={() => navigate(e.to)}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <e.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 font-medium">
                      {e.label} <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 font-medium">最近入账</h2>
              {rewards.length === 0 ? (
                <EmptyState text="还没有收益记录，上传作品并上架后开始累积" className="py-8" />
              ) : (
                <div className="divide-y divide-border">
                  {rewards.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-2.5">
                      <Badge variant="outline" className="w-14 justify-center text-[10px]">分成</Badge>
                      <p className="min-w-0 flex-1 truncate text-sm">{t.note}</p>
                      <span className="text-sm font-medium text-success">+{t.coin} 币</span>
                      <span className="hidden w-20 text-right text-[11px] text-muted-foreground sm:block">{fmtTime(t.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="books" className="space-y-3 pt-3">
          {books.length === 0 ? (
            <EmptyState text="还没有作品，从上方入口上传第一本" />
          ) : (
            books.map((book) => {
              const meta = STATUS_META[book.status] ?? STATUS_META.draft;
              return (
                <div key={book.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="w-12 shrink-0">
                    <BookCover seed={book.coverSeed} title={book.title} author={book.authorName} genre={book.genre} style={book.coverStyle} bookId={book.id} coverType={book.coverType} font={book.coverFont}  type={book.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{book.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[book.type]}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{book.views}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{book.likes}</span>
                      <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {book.status === 'published' && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/book/${book.id}`)}>
                        查看
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/creator/upload-${book.type}?edit=${book.id}`)}>
                      <PencilLine className="mr-1 h-3.5 w-3.5" /> 编辑
                    </Button>
                    {statusBtn(book)}
                    <Button size="icon" variant="ghost" aria-label="删除" onClick={() => setToDelete(book)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/creator/upload-novel')}>
            <Plus className="h-4 w-4" /> 新建作品
          </Button>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除《{toDelete?.title}》？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后章节与剧本将一并移除，此操作不可恢复。已产生的收益记录会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  api.deleteBook(toDelete.id);
                  toast.success('已删除');
                }
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
