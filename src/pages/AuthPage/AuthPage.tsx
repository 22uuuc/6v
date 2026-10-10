// EXPORTS: AuthPage（组件文件）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Smartphone, Mail, KeyRound, MessageCircle, QrCode, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import MoyingMascot from '@/components/MoyingMascot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const loginSchema = z.object({
  username: z.string().min(1, '请输入账号'),
  password: z.string().min(1, '请输入密码'),
});

const accountSchema = z.object({
  username: z.string().min(3, '账号至少 3 位').max(20, '账号最长 20 位'),
  nickname: z.string().min(1, '请输入昵称').max(12, '昵称最长 12 位'),
  password: z.string().min(6, '密码至少 6 位'),
});

const phoneSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位验证码'),
  nickname: z.string().min(1, '请输入昵称').max(12, '昵称最长 12 位'),
  password: z.string().min(6, '密码至少 6 位'),
});

const emailSchema = z.object({
  email: z.string().email('请输入正确的邮箱'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位验证码'),
  nickname: z.string().min(1, '请输入昵称').max(12, '昵称最长 12 位'),
  password: z.string().min(6, '密码至少 6 位'),
});

const DEMO_ACCOUNTS = [
  { role: '管理员', username: 'admin', password: 'admin123' },
  { role: '创作者', username: 'zhiliao', password: '123456' },
  { role: '读者', username: 'reader1', password: '123456' },
];

type RegisterMode = 'account' | 'phone' | 'email';

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [regMode, setRegMode] = useState<RegisterMode>('account');
  const [sentCode, setSentCode] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSentCode, setEmailSentCode] = useState('');
  const [emailSending, setEmailSending] = useState(false);
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

  /** 忘记密码：向后端申请验证码（验证码由后端生成并校验，演示环境直接显示） */
  const sendForgotCode = () => {
    if (!fAccount.trim()) {
      toast.error('请先输入注册账号（用户名 / 手机号 / 邮箱）');
      return;
    }
    const res = api.requestResetCode(fAccount.trim());
    if (!res.ok) {
      toast.error(res.msg ?? '发送失败');
      return;
    }
    startCountdown();
    toast.info(`${res.msg}：${res.demoCode}`);
  };

  const doResetPwd = async () => {
    if (!fAccount.trim() || !fCode.trim()) {
      toast.error('请填写账号与验证码');
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

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });
  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: '', nickname: '', password: '' },
  });
  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '', code: '', nickname: '', password: '' },
  });
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', nickname: '', password: '' },
  });

  const onLogin = async (v: z.infer<typeof loginSchema>) => {
    const res = await api.login(v.username, v.password);
    if (!res.ok) {
      toast.error(res.msg ?? '登录失败');
      return;
    }
    toast.success(`欢迎回来，${res.user?.nickname}`);
    navigate('/profile');
  };

  const onAccountRegister = async (v: z.infer<typeof accountSchema>) => {
    const res = await api.register(v.username, v.password, v.nickname);
    if (!res.ok) {
      toast.error(res.msg ?? '注册失败');
      return;
    }
    toast.success('注册成功，赠送 100 书币');
    navigate('/profile');
  };

  const sendSms = () => {
    const phone = phoneForm.getValues('phone');
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请先输入正确的 11 位手机号');
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(code);
    setSending(true);
    toast.success(`验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(7)}（演示：${code}）`, { duration: 30000 });
    window.setTimeout(() => setSending(false), 60000);
  };

  const onPhoneRegister = async (v: z.infer<typeof phoneSchema>) => {
    if (!sentCode) {
      toast.error('请先获取验证码');
      return;
    }
    if (v.code !== sentCode) {
      toast.error('验证码错误');
      return;
    }
    const res = await api.register(v.phone, v.password, v.nickname);
    if (!res.ok) {
      toast.error(res.msg === '账号已存在' ? '该手机号已注册，可直接登录' : res.msg ?? '注册失败');
      return;
    }
    api.verifyPhone(res.user!.id); // 验证码注册通过 → 手机认证打标（认证等级提升）
    toast.success('注册成功，赠送 100 书币');
    navigate('/profile');
  };

  const onEmailRegister = async (v: z.infer<typeof emailSchema>) => {
    if (!emailSentCode) {
      toast.error('请先获取邮箱验证码');
      return;
    }
    if (v.code !== emailSentCode) {
      toast.error('验证码错误');
      return;
    }
    const res = await api.register(v.email, v.password, v.nickname);
    if (!res.ok) {
      toast.error(res.msg === '账号已存在' ? '该邮箱已注册，可直接登录' : res.msg ?? '注册失败');
      return;
    }
    api.verifyEmail(res.user!.id); // 邮箱验证码注册通过 → 邮箱认证打标
    toast.success('注册成功，赠送 100 书币');
    navigate('/profile');
  };

  const sendEmailCode = () => {
    const email = emailForm.getValues('email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('请先输入正确的邮箱地址');
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setEmailSentCode(code);
    setEmailSending(true);
    toast.success(`验证码已发送至 ${email}（演示：${code}）`, { duration: 30000 });
    window.setTimeout(() => setEmailSending(false), 60000);
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

  return (<div className="page-enter mx-auto max-w-sm py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        {/* 书灵迎宾：登录时读书（等你回来）、注册时开心（欢迎新朋友） */}
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

        <TabsContent value="login">
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="space-y-3">
              <FormField
                control={loginForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>账号 / 手机号 / 邮箱</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入账号" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="请输入密码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="btn-anime w-full" disabled={loginForm.formState.isSubmitting}>
                登录
              </Button>
              <div className="flex justify-end">
                <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                  忘记密码？通过验证码找回
                </button>
              </div>
            </form>
          </Form>

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
        </TabsContent>

        <TabsContent value="register">
          <Tabs value={regMode} onValueChange={(v) => setRegMode(v as RegisterMode)}>
            <TabsList className="grid w-full grid-cols-3 rounded-full border border-border/60 bg-muted/50 p-1">
              <TabsTrigger value="account" className="gap-1">
                <KeyRound className="h-3.5 w-3.5" /> 账号
              </TabsTrigger>
              <TabsTrigger value="phone" className="gap-1">
                <Smartphone className="h-3.5 w-3.5" /> 手机号
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-1">
                <Mail className="h-3.5 w-3.5" /> 邮箱
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="pt-3">
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onAccountRegister)} noValidate className="space-y-3">
                  <FormField
                    control={accountForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>账号</FormLabel>
                        <FormControl>
                          <Input placeholder="3-20 位字母数字" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={accountForm.control}
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
                    control={accountForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="至少 6 位" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="btn-anime w-full" disabled={accountForm.formState.isSubmitting}>
                    注册并赠送 100 书币
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="phone" className="pt-3">
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(onPhoneRegister)} noValidate className="space-y-3">
                  <FormField
                    control={phoneForm.control}
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
                    control={phoneForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>验证码</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="6 位验证码" inputMode="numeric" maxLength={6} {...field} className="flex-1" />
                            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={sendSms} disabled={sending}>
                              {sending ? '已发送(60s)' : '获取验证码'}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={phoneForm.control}
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
                    control={phoneForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="至少 6 位" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="btn-anime w-full" disabled={phoneForm.formState.isSubmitting}>
                    手机号注册并赠送 100 书币
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="email" className="pt-3">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailRegister)} noValidate className="space-y-3">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input placeholder="example@mail.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱验证码</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="6 位验证码" inputMode="numeric" maxLength={6} {...field} className="flex-1" />
                            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={sendEmailCode} disabled={emailSending}>
                              {emailSending ? '已发送(60s)' : '获取验证码'}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailForm.control}
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
                    control={emailForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="至少 6 位" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="btn-anime w-full" disabled={emailForm.formState.isSubmitting}>
                    邮箱注册并赠送 100 书币
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <Card className="mt-5">
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">演示账号（点击填入）</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((d) => (
              <button
                key={d.username}
                type="button"
                className="rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs transition-colors hover:border-primary/60"
                onClick={() => {
                  setTab('login');
                  loginForm.setValue('username', d.username);
                  loginForm.setValue('password', d.password);
                }}
              >
                {d.role} · {d.username}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 忘记密码：账号 + 演示验证码 + 新密码 */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>找回密码</DialogTitle>
            <DialogDescription>
              输入注册时使用的账号（用户名 / 手机号 / 邮箱），验证通过后设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>注册账号</Label>
              <Input value={fAccount} onChange={(e) => setFAccount(e.target.value)} placeholder="用户名 / 手机号 / 邮箱" />
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
    </div>
  );
}
