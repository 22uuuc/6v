// EXPORTS: AdminUsers（组件文件）
import { useMemo, useState } from 'react';
import { Crown, ShieldOff, Shield, Search, BadgeCheck, Medal, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { api, isVip } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';
import { avatarSVG } from '@/lib/svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserRole } from '@/lib/types';

const ROLE_LABEL: Record<string, string> = { reader: '读者', creator: '创作者', admin: '管理员' };

export default function AdminUsers() {
  const [kw, setKw] = useState('');
  const [coinDelta, setCoinDelta] = useState<Record<string, string>>({});
  useDataVersion();
  const { user } = useAuth();
  const users = api.allUsers();

  const filtered = useMemo(() => {
    const q = kw.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q));
  }, [users, kw]);

  const adjust = (u: { id: string; nickname: string }) => {
    const raw = coinDelta[u.id] ?? '';
    const n = Number(raw);
    if (!raw || Number.isNaN(n) || n === 0) {
      toast.error('请输入不为 0 的调整值（正数发放、负数扣除）');
      return;
    }
    if (!user) return;
    api.adjustCoins(u.id, n, user.id);
    setCoinDelta((p) => ({ ...p, [u.id]: '' }));
    toast.success(`已为 ${u.nickname} ${n > 0 ? '发放' : '扣除'} ${Math.abs(n)} 书币`);
  };

  return (<div className="page-enter space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">共 {users.length} 位用户 · VIP 授权 / 等级调整 / 封禁解封 / 书币调整，操作均写入审计日志</p>
        <div className="w-56">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜账号 / 昵称" className="pl-8" />
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[880px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">用户</TableHead>
                <TableHead className="whitespace-nowrap">角色</TableHead>
                <TableHead className="whitespace-nowrap">VIP 状态</TableHead>
                <TableHead className="whitespace-nowrap">等级</TableHead>
                <TableHead className="whitespace-nowrap">书币</TableHead>
                <TableHead className="whitespace-nowrap">书币调整</TableHead>
                <TableHead className="whitespace-nowrap">注册时间</TableHead>
                <TableHead className="whitespace-nowrap">VIP 授权</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                        <div dangerouslySetInnerHTML={{ __html: avatarSVG(u.id, u.nickname) }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[120px] truncate text-sm font-medium">{u.nickname}</span>
                        <span className="block text-[11px] text-muted-foreground">@{u.username}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => { if (user) { api.setRole(u.id, v as UserRole, user.id); toast.success(`已将 ${u.nickname} 设为${ROLE_LABEL[v]}`); } }}>
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reader">读者</SelectItem>
                        <SelectItem value="creator">创作者</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {isVip(u) ? (
                      <Badge className="gap-1"><Crown className="h-3 w-3" /> VIP</Badge>
                    ) : (
                      <Badge variant="outline">普通</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Medal className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <Select value={String(u.level ?? 1)} onValueChange={(v) => { if (user) { api.setLevel(u.id, Number(v), user.id); toast.success(`已将 ${u.nickname} 设为 Lv.${v}（${api.levelTitle(Number(v))}）`); } }}>
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((lv) => (
                            <SelectItem key={lv} value={String(lv)}>Lv.{lv} {api.levelTitle(lv)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-[10px] text-muted-foreground">exp {u.exp ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{u.coins.toLocaleString('zh-CN')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={coinDelta[u.id] ?? ''}
                        onChange={(e) => setCoinDelta((p) => ({ ...p, [u.id]: e.target.value }))}
                        placeholder="±数量"
                        className="h-8 w-20 text-xs"
                      />
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => adjust(u)} disabled={u.role === 'admin'}>
                        <Coins className="h-3.5 w-3.5" /> 调币
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{u.createdAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    {isVip(u) ? (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { if (user) { api.setVip(u.id, false, 30, user.id); toast.success(`已取消 ${u.nickname} 的 VIP`); } }}>
                        <ShieldOff className="h-3.5 w-3.5" /> 取消 VIP
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1" onClick={() => { if (user) { api.setVip(u.id, true, 30, user.id); toast.success(`已为 ${u.nickname} 开通 30 天 VIP`); } }}>
                        <Crown className="h-3.5 w-3.5" /> 授权 VIP
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.role === 'admin' ? (
                      <span className="text-xs text-muted-foreground">管理员</span>
                    ) : u.banned ? (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { if (user) { api.setBanned(u.id, false, user.id); toast.success(`已解封 ${u.nickname}`); } }}>
                        <Shield className="h-3.5 w-3.5" /> 解封
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => { if (user) { api.setBanned(u.id, true, user.id); toast.success(`已封禁 ${u.nickname}`); } }}>
                        <BadgeCheck className="h-3.5 w-3.5" /> 封禁
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
