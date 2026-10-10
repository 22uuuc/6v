// 登录注册方式收敛：用户侧只支持 手机号验证码 / 微信 / QQ 三种（账号密码注册登录仅管理员从后端使用）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Smartphone, MessageCircle, QrCode, KeyRound, RotateCcw, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import MoyingMascot from '@/components/MoyingMascot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const phoneLoginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位验证码'),
});

const phoneRegSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位验证码'),
  nickname: z.string().min(1, '请输入昵称').max(12, '昵称最长 12 位'),
  password: z.string().min(6, '密码至少 6 位（提现二次验证用）'),
});

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginSmsSending, setLoginSmsSending] = useState(false);
  const [regSending, setRegSending] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPwd, setAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fAccount, setFAccount] = useState('');
  const [fCode, setFCode] = useState('');
  const [fCountdown, setFCountdown] = useState(0);
  const [fNewPwd, setFNewPwd] = useState('');
  const [fNewPwd2, setFNewPwd2] = useState('');

  /** 验证码重发倒计时（60 秒） */
  const startCountdown = () => {
    setFCountdown(60);
    const tick = () => {
      setFCountdown((s) => {
        if (s <= 1) return 0;
        setTimeout(tick, 1000);
        return s - 1;
      });
    };
    setTimeout(tick, 1000);
  };

  /** 手机号验证码登录：验证码由后端生成并校验 */
  const sendLoginSms = async () => {
    if (!/^1[3-9]\d{9}$/.test(loginPhone)) {
      toast.error('请先输入正确的 11 位手机号');
      return;
    }
    const res = await api.sendCode(loginPhone, 'phone_login');
    if (!res.ok) {
      toast.error(res.msg ?? '发送失败');
      return;
    }
    setLoginSmsSending(true);
    toast.info(`${res.msg}：${res.demoCode}`);
    window.setTimeout(() => setLoginSmsSending(false), 60000);
  };

  const doPhoneLogin = async () => {
    if (!/^1[3-9]\d{9}$/.test(loginPhone)) {
      toast.error('请输入正确的手机号');
      return;
    }
    if (!loginCode.trim()) {
      toast.error('请输入验证码');
      return;
    }
    const res = await api.phoneLogin(loginPhone, loginCode.trim());
    if (!res.ok) {
      toast.error(res.msg ?? '登录失败');
      return;
    }
    toast.success(`欢迎回来，${res.user?.nickname}`);
    navigate('/profile');
  };

  const loginForm = useForm<z.infer<typeof phoneLoginSchema>>({
    resolver: zodResolver(phoneLoginSchema),
    defaultValues: { phone: '', code: '' },
  });
  const regForm = useForm<z.infer<typeof phoneRegSchema>>({
    resolver: zodResolver(phoneRegSchema),
    defaultValues: { phone: '', code: '', nickname: '', password: '' },
  });

  /** 注册：手机号验证码 + 首次设置密码（提现二次验证） */
  const sendRegSms = async () => {
    const phone = regForm.getValues('phone');
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请先输入正确的 11 位手机号');
      return;
    }
    const res = await api.sendCode(phone, 'register');
    if (!res.ok) {
      toast.error(res.msg ?? '发送失败');
      return;
    }
    setRegSending(true);
    toast.success(`验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(7)}：${res.demoCode}`, { duration: 30000 });
    window.setTimeout(() => setRegSending(false), 60000);
  };

  const onPhoneRegister = async (v: z.infer<typeof phoneRegSchema>) => {
    const res = await api.phoneRegister(v.phone, v.code, v.password, v.nickname);
    if (!res.ok) {
      toast.error(res.msg === '该手机号已注册，可直接登录' ? '该手机号已注册，可直接登录' : res.msg ?? '注册失败');
      return;
    }
    toast.success('注册成功，赠送 100 书币');
    navigate('/profile');
  };

  /** 忘记密码：手机号验证码找回（验证码由后端生成并校验） */
  const sendForgotCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(fAccount.trim())) {
      toast.error('请输入注册时使用的 11 位手机号');
      return;
    }
    const res = await api.requestResetCode(fAccount.trim());
    if (!res.ok) {
      toast.error(res.msg ?? '发送失败');
      return;
    }
    startCountdown();
    toast.info(`${res.msg}：${res.demoCode}`);
  };

  const doResetPwd = async () => {
    if (!fAccount.trim() || !fCode.trim()) {
      toast.error('请填写手机号与验证码');
      return;
    }
    if (fNewPwd.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (fNewPwd !== fNewPwd2) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    const res = await api.resetPassword(fAccount.trim(), fCode.trim(), fNewPwd);
    if (!res.ok) {
      toast.error(res.msg ?? '重置失败');
      return;
    }
    setForgotOpen(false);
    setFAccount('');
    setFCode('');
    setFNewPwd('');
    setFNewPwd2('');
    setFCountdown(0);
    toast.success('密码已重置，请使用新密码登录');
  };

  const thirdParty = async (provider: 'wechat' | 'qq') => {
    const res = await api.thirdPartyLogin(provider);
    if (!res.ok) {
      toast.error(res.msg ?? '第三方登录失败');
      return;
    }
    toast.success(`已通过${provider === 'wechat' ? '微信' : 'QQ'}登录，欢迎 ${res.user?.nickname}`);
    navigate('/profile');
  };

  /** 管理员专用登录：密码仅对管理员账号有效（普通用户密码登录后端 403），登录后进入管理后台审核 */
  const doAdminLogin = async () => {
    if (!adminUser.trim() || !adminPwd) {
      toast.error('请输入管理员账号与密码');
      return;
    }
    const res = await api.login(adminUser.trim(), adminPwd);
    if (!res.ok) {
      setAdminMsg(res.msg ?? '登录失败');
      return;
    }
    if (res.user?.role !== 'admin') {
      setAdminMsg('该账号不是管理员，用户侧请使用手机号/微信/QQ 登录');
      return;
    }
    setAdminOpen(false);
    setAdminMsg('');
    toast.success(`管理员 ${res.user.nickname} 已登录`);
    navigate('/admin');
  };

  return (<div className="page-enter mx-auto max-w-sm py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="mascot-float drop-shadow-[0_0_16px_rgba(168,130,255,0.4)]">
          <MoyingMascot mood={tab === 'login' ? 'reading' : 'happy'} size={88} art />
        </div>
        <h1 className="text-gradient-anime font-serif text-2xl font-bold">墨影书城</h1>
        <p className="text-sm text-muted-foreground">
          {tab === 'login'
            ? '欢迎回来，书灵给你留了灯 · 收藏订阅打赏都在老地方'
            : '新朋友来啦，注册即送 100 书币，书灵带你入坑'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
        <TabsList className="grid w-full grid-cols-2 rounded-full border border-border/60 bg-muted/50 p-1">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="pt-3">
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              <Smartphone className="mr-1 inline h-4 w-4" /> 手机号验证码登录（未注册自动注册）
            </p>
            <div className="flex gap-2">
              <Input placeholder="11 位手机号" inputMode="numeric" maxLength={11} value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} />
              <Button type="button" variant="outline" className="shrink-0" disabled={loginSmsSending} onClick={sendLoginSms}>
                {loginSmsSending ? '已发送(60s)' : '获取验证码'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="6 位验证码" inputMode="numeric" maxLength={6} value={loginCode} onChange={(e) => setLoginCode(e.target.value)} />
              <Button type="button" className="shrink-0" onClick={doPhoneLogin}>
                <Smartphone className="mr-1 h-4 w-4" /> 登录
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-center text-xs text-muted-foreground">或使用第三方快捷登录</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => thirdParty('wechat')}>
                <MessageCircle className="h-4 w-4 text-success" /> 微信登录
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => thirdParty('qq')}>
                <QrCode className="h-4 w-4 text-primary" /> QQ 登录
              </Button>
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
              忘记密码？通过手机号验证码找回
            </button>
          </div>
          <div className="mt-2 flex justify-center">
            <button type="button" onClick={() => setAdminOpen(true)} className="text-[11px] text-muted-foreground/70 underline-offset-4 hover:text-foreground hover:underline">
              管理员入口（审核作品 / 后台管理）
            </button>
          </div>
        </TabsContent>

        <TabsContent value="register" className="pt-3">
          <Form {...regForm}>
            <form onSubmit={regForm.handleSubmit(onPhoneRegister)} noValidate className="space-y-3">
              <FormField
                control={regForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>手机号</FormLabel>
                    <FormControl>
                      <Input placeholder="11 位手机号" inputMode="numeric" maxLength={11} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={regForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>验证码</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input placeholder="6 位验证码" inputMode="numeric" maxLength={6} {...field} className="flex-1" />
                        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={sendRegSms} disabled={regSending}>
                          {regSending ? '已发送(60s)' : '获取验证码'}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={regForm.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>昵称</FormLabel>
                    <FormControl>
                      <Input placeholder="你希望被叫的名字" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={regForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码（提现二次验证用）</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="至少 6 位" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="btn-anime w-full" disabled={regForm.formState.isSubmitting}>
                手机号注册并赠送 100 书币
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>

      {/* 忘记密码：手机号 + 演示验证码 + 新密码 */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>找回密码</DialogTitle>
            <DialogDescription>
              输入注册时使用的手机号，验证通过后设置新密码（用于提现二次验证）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>手机号</Label>
              <Input value={fAccount} onChange={(e) => setFAccount(e.target.value)} placeholder="11 位手机号" inputMode="numeric" maxLength={11} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>验证码</Label>
                <Input value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="6 位验证码" maxLength={6} />
              </div>
              <Button type="button" variant="outline" className="mt-6 shrink-0" onClick={sendForgotCode} disabled={fCountdown > 0}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {fCountdown > 0 ? `${fCountdown}s 后重发` : '发送验证码'}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>新密码</Label>
              <Input type="password" value={fNewPwd} onChange={(e) => setFNewPwd(e.target.value)} placeholder="至少 6 位" maxLength={32} />
            </div>
            <div className="space-y-1.5">
              <Label>确认新密码</Label>
              <Input type="password" value={fNewPwd2} onChange={(e) => setFNewPwd2(e.target.value)} placeholder="再输入一次" maxLength={32} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>取消</Button>
            <Button onClick={doResetPwd} disabled={!fAccount || !fCode || !fNewPwd || !fNewPwd2}>
              <KeyRound className="mr-1 h-4 w-4" /> 重置密码
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 管理员专用登录：密码通道仅管理员有效（用户侧登录方式不受影响） */}
      <Dialog open={adminOpen} onOpenChange={(v) => { setAdminOpen(v); if (!v) setAdminMsg(''); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>管理员登录</DialogTitle>
            <DialogDescription>
              仅后端管理员账号可通过（审核作品、资质、结算等后台操作）。普通账号请使用手机号/微信/QQ 登录。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>管理员账号</Label>
              <Input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="admin" autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label>密码</Label>
              <Input type="password" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)} placeholder="管理员密码" autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && doAdminLogin()} />
            </div>
            {adminMsg && <p className="text-xs text-destructive">{adminMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdminOpen(false); setAdminMsg(''); }}>取消</Button>
            <Button onClick={doAdminLogin}>
              <ShieldCheck className="mr-1 h-4 w-4" /> 进入后台
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
