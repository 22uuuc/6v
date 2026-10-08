// EXPORTS: AdminCloudSync（管理员后台 · 云端内容库同步面板）
// 用 GitHub 仓库（22uuuc/6v）作为内容库数据库：
//  - 拉取：配置令牌走 API（支持私有仓库）；未配置令牌匿名拉取公开仓库
//  - 推送：管理员配置 GitHub 令牌 + 加密口令，AES-GCM 加密 + HMAC 签名后落库
import { useState } from 'react';
import { Cloud, Download, Upload, KeyRound, Database, ShieldCheck, GitBranch, ExternalLink, Lock, Unlock, Palette, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cloud } from '@/lib/cloud';
import { useDataVersion } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function AdminCloudSync() {
  useDataVersion();
  const [tokenInput, setTokenInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [busy, setBusy] = useState<'pull' | 'push' | null>(null);
  const [uTokenInput, setUTokenInput] = useState('');
  const [uPassInput, setUPassInput] = useState('');
  const [uBusy, setUBusy] = useState<'pull' | 'push' | null>(null);
  // 一键改口令
  const [newPassInput, setNewPassInput] = useState('');
  const [rotateBusy, setRotateBusy] = useState(false);
  // 平台设置仓（第三库）
  const [sBusy, setSBusy] = useState<'pull' | 'push' | null>(null);
  const sRepo = cloud.settingsRepo();
  const sFiles = cloud.settingsFiles();
  const sTokenSaved = cloud.settingsTokenSaved();
  const meta = cloud.meta();
  const tokenSaved = cloud.tokenSaved();
  const passSaved = cloud.passSaved();
  const repo = cloud.repo();
  const uMeta = cloud.userMeta();
  const uTokenSaved = cloud.userTokenSaved();
  const uPassSaved = cloud.userPassSaved();
  const uRepo = cloud.userRepo();

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('zh-CN') : '从未');

  const handlePull = async () => {
    setBusy('pull');
    const r = await cloud.pullFromCloud();
    setBusy(null);
    if (r.ok) {
      toast.success(r.msg ?? '拉取完成');
    } else {
      toast.error(r.msg ?? '拉取失败');
    }
    if (r.failed && r.failed.length > 0) {
      toast.info(`未同步：${r.failed.join('、')}`);
    }
  };  const handlePush = async () => {
    if (!tokenInput.trim() && !tokenSaved) {
      toast.error('请先填写并保存 GitHub 令牌');
      return;
    }
    setBusy('push');
    const r = await cloud.pushToCloud(tokenInput.trim() || undefined);
    setBusy(null);
    if (r.ok) {
      toast.success(r.msg ?? '推送完成');
      if (tokenInput.trim()) {
        cloud.saveToken(tokenInput.trim());
        setTokenInput('');
      }
    } else {
      toast.error(r.msg ?? '推送失败');
    }
    if (r.failed && r.failed.length > 0) {
      toast.info(`未推送：${r.failed.join('、')}`);
    }
  };

  const handleClearToken = () => {
    cloud.clearToken();
    setTokenInput('');
    toast.success('已清除本地令牌');
  };

  const handleUserPull = async () => {
    setUBusy('pull');
    const r = await cloud.pullUserData();
    setUBusy(null);
    if (r.ok) {
      toast.success(r.msg ?? '拉取完成');
    } else {
      toast.error(r.msg ?? '拉取失败');
    }
    if (r.failed && r.failed.length > 0) {
      toast.info(`未同步：${r.failed.join('、')}`);
    }
  };

  const handleUserPush = async () => {
    if (!uTokenInput.trim() && !uTokenSaved) {
      toast.error('请先填写并保存用户数据仓库令牌');
      return;
    }
    setUBusy('push');
    const r = await cloud.pushUserData(uTokenInput.trim() || undefined);
    setUBusy(null);
    if (r.ok) {
      toast.success(r.msg ?? '推送完成');
      if (uTokenInput.trim()) {
        cloud.saveUserToken(uTokenInput.trim());
        setUTokenInput('');
      }
    } else {
      toast.error(r.msg ?? '推送失败');
    }
    if (r.failed && r.failed.length > 0) {
      toast.info(`未推送：${r.failed.join('、')}`);
    }
  };

  const handleClearUserToken = () => {
    cloud.clearUserToken();
    setUTokenInput('');
    toast.success('已清除用户数据仓库令牌');
  };

  const handleSaveUserPass = () => {
    if (uPassInput.trim().length < 6) {
      toast.error('用户数据仓库加密口令至少 6 位');
      return;
    }
    cloud.saveUserPass(uPassInput.trim());
    setUPassInput('');
    toast.success('用户数据仓库加密口令已保存（推送将加密落库，明文用户数据拒收）');
  };

  /* ---- 平台设置仓（第三库：全站设置/排版风格 + 认证会话） ---- */

  const handleSettingsPull = async () => {
    setSBusy('pull');
    const r = await cloud.pullSettings();
    setSBusy(null);
    if (r.ok) {
      toast.success(r.msg ?? '设置仓拉取成功');
    } else {
      toast.error(r.msg ?? '拉取失败');
    }
    if (r.failed && r.failed.length > 0) toast.info(`未拉取：${r.failed.join('、')}`);
  };

  const handleSettingsPush = async () => {
    setSBusy('push');
    const r = await cloud.pushSettings();
    setSBusy(null);
    if (r.ok) {
      toast.success(r.msg ?? '设置仓推送成功');
    } else {
      toast.error(r.msg ?? '推送失败');
    }
    if (r.failed && r.failed.length > 0) toast.info(`未推送：${r.failed.join('、')}`);
  };

  const handleSavePass = () => {
    if (passInput.trim().length < 6) {
      toast.error('加密口令至少 6 位');
      return;
    }
    cloud.savePass(passInput.trim());
    setPassInput('');
    toast.success('云端加密口令已保存（推送将加密落库，拉取需验签）');
  };

  /** 一键修改全部加密口令：换新口令并自动重推三仓（内容库/用户库/设置仓） */
  const handleRotatePass = async () => {
    if (newPassInput.trim().length < 6) {
      toast.error('新口令至少 6 位');
      return;
    }
    setRotateBusy(true);
    const r = await cloud.rotateAllPasswords(newPassInput.trim());
    setRotateBusy(false);
    if (r.ok) {
      toast.success(r.msg);
      setNewPassInput('');
    } else {
      toast.error(r.msg);
      toast.info(r.results.map((x) => `${x.repo}：${x.ok ? '成功' : x.msg || '失败'}`).join('；'));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-primary" /> GitHub 云端内容库
            {tokenSaved ? <Badge className="bg-emerald-500/15 text-emerald-600">令牌已配置</Badge> : <Badge variant="outline">未配置令牌</Badge>}
            {passSaved ? (
              <Badge className="bg-emerald-500/15 text-emerald-600">
                <Lock className="mr-0.5 h-3 w-3" /> 加密已启用
              </Badge>
            ) : (
              <Badge variant="outline">
                <Unlock className="mr-0.5 h-3 w-3" /> 未设加密口令
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Database className="h-3.5 w-3.5" /> 仓库</div>
              <div className="mt-1 font-medium">
                {repo.owner}/{repo.name}
                <span className="ml-1.5 text-xs text-muted-foreground">分支 {repo.branch}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">内容库目录 db/ · 共 {cloud.files().length} 个数据文件</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> 同步状态</div>
              <div className="mt-1 font-medium">最后拉取：{fmt(meta.lastPullAt)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">最后推送：{fmt(meta.lastPushAt)}</div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground"><GitBranch className="h-3.5 w-3.5" /> 工作原理（加密 · 防篡改）</div>
            所有读者/创作者的浏览器首次打开时，会自动拉取共享内容库（书籍/章节/漫画/互动剧本），看到同一份书城。管理员在后台审核上架、运营调整后，点击<b>推送</b>把最新内容库写回仓库。<br />
            <b>防篡改保护：</b>推送时内容先经 <b>AES-GCM 加密 + HMAC-SHA256 签名</b> 再落库（仓库里只有密文，明文不可见）；拉取时先验签——仓库数据被任何人恶意篡改都会验签失败并被安全中心拒收，随后才解密并通过内容查杀扫描。<br />
            <b>私有仓库：</b>若把仓库设为私有（GitHub 仓库页 → Settings → Danger Zone → Change visibility），拉取必须配置令牌；建议同时设私有 + 开启加密，双保险。
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Database className="h-3.5 w-3.5 text-primary" /> 数据架构 · 三权分离
            </div>
            <p className="mt-1.5">
              <b>① 后端（仅开发人员可操作）：</b>内容库与代码仓库由开发人员持令牌维护——仓库数据加密存储、只有开发者能推送修改，前端用户无法改动软件信息与后端数据。<br />
              <b>② 管理员（运营可操作）：</b>在后台审核作品 / 收益 / 提现 / 退款，调整全站设置，并把内容库推送同步到后端仓库。<br />
              <b>③ 前端用户（只使用）：</b>读者浏览、阅读、充值、打赏；创作者创作、上传作品（提交后走审核）。所有用户操作不会直接修改后端代码与数据，前端内容<b>随后端变化</b>——后端推送后，用户下次打开即可看到最新书城。
            </p>
          </div>

          <div className="space-y-2">
            <Label>GitHub 令牌（推送/私有仓库拉取时使用，只保存在本机浏览器）</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={tokenSaved ? '已保存令牌（留空则用已保存的）' : 'ghp_xxx 或 github_pat_xxx'}
                autoComplete="off"
              />
              <Button
                variant="outline"
                onClick={() => {
                  cloud.saveToken(tokenInput);
                  setTokenInput('');
                  toast.success('令牌已保存到本机浏览器');
                }}
                disabled={!tokenInput.trim()}
              >
                <KeyRound className="mr-1 h-3.5 w-3.5" /> 保存
              </Button>
              {tokenSaved && (
                <Button variant="outline" onClick={handleClearToken} className="text-destructive">
                  清除
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              如何生成令牌：GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → 选择仓库 {repo.owner}/{repo.name}，勾选 Contents 读写权限。令牌只会用于向该仓库推送内容库。
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                打开生成页 <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label>云端加密口令（≥6 位，未设置时禁止推送，防止明文入库）</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder={passSaved ? '已设置加密口令（输入新口令可更换）' : '设置加密口令'}
                autoComplete="off"
              />
              <Button variant="outline" onClick={handleSavePass} disabled={!passInput.trim()}>
                <Lock className="mr-1 h-3.5 w-3.5" /> 保存口令
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              口令只保存在本机浏览器（混淆存储），用于本地派生 AES-GCM / HMAC 密钥。更换口令后，仓库中的旧密文将无法解密（拉取会提示验签失败），请谨慎操作。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePull} disabled={busy !== null}>
              <Download className="mr-1 h-4 w-4" /> {busy === 'pull' ? '拉取中…' : '从云端拉取内容库'}
            </Button>
            <Button variant="default" onClick={handlePush} disabled={busy !== null}>
              <Upload className="mr-1 h-4 w-4" /> {busy === 'push' ? '推送中…' : '加密推送本地内容库'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" /> GitHub 用户数据仓库（与内容/代码仓库分离）
            {uTokenSaved ? <Badge className="bg-emerald-500/15 text-emerald-600">令牌已配置</Badge> : <Badge variant="outline">未配置令牌</Badge>}
            {uPassSaved ? (
              <Badge className="bg-emerald-500/15 text-emerald-600">
                <Lock className="mr-0.5 h-3 w-3" /> 加密已启用
              </Badge>
            ) : (
              <Badge variant="outline">
                <Unlock className="mr-0.5 h-3 w-3" /> 未设加密口令
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Database className="h-3.5 w-3.5" /> 用户数据仓库</div>
              <div className="mt-1 font-medium">
                {uRepo.owner}/{uRepo.name}
                <span className="ml-1.5 text-xs text-muted-foreground">分支 {uRepo.branch}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">数据目录 db/ · 共 {cloud.userFiles().length} 个用户数据文件</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> 同步状态</div>
              <div className="mt-1 font-medium">最后拉取：{fmt(uMeta.lastPullAt)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">最后推送：{fmt(uMeta.lastPushAt)}</div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground"><GitBranch className="h-3.5 w-3.5" /> 与内容库分离存储</div>
            注册用户、余额、交易流水、收益结算、提现申请、支付配置、资质申请等<b>用户信息数据</b>与<b>内容/代码仓库</b>（{repo.owner}/{repo.name}）分开存放，两个仓库使用<b>各自独立的令牌与加密口令</b>。<br />
            <b>隐私与防篡改：</b>用户数据仓库只接受加密文件——推送时 AES-GCM 加密 + HMAC 签名落库，明文用户数据一律拒收；拉取先验签再解密，仓库数据被恶意篡改即验签失败并被安全中心拒收。该仓库<b>建议设为私有</b>（Settings → Danger Zone → Change visibility），仅管理员/开发人员可操作。
          </div>

          <div className="space-y-2">
            <Label>用户数据仓库令牌（推送/拉取时使用，只保存在本机浏览器）</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={uTokenInput}
                onChange={(e) => setUTokenInput(e.target.value)}
                placeholder={uTokenSaved ? '已保存令牌（留空则用已保存的）' : 'ghp_xxx 或 github_pat_xxx'}
                autoComplete="off"
              />
              <Button
                variant="outline"
                onClick={() => {
                  cloud.saveUserToken(uTokenInput);
                  setUTokenInput('');
                  toast.success('用户数据仓库令牌已保存到本机浏览器');
                }}
                disabled={!uTokenInput.trim()}
              >
                <KeyRound className="mr-1 h-3.5 w-3.5" /> 保存
              </Button>
              {uTokenSaved && (
                <Button variant="outline" onClick={handleClearUserToken} className="text-destructive">
                  清除
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              令牌需对该仓库勾选 Contents 读写权限。
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                打开生成页 <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label>用户数据仓库加密口令（≥6 位，独立于内容库口令）</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={uPassInput}
                onChange={(e) => setUPassInput(e.target.value)}
                placeholder={uPassSaved ? '已设置加密口令（输入新口令可更换）' : '设置加密口令'}
                autoComplete="off"
              />
              <Button variant="outline" onClick={handleSaveUserPass} disabled={!uPassInput.trim()}>
                <Lock className="mr-1 h-3.5 w-3.5" /> 保存口令
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              口令只保存在本机浏览器，用于派生用户数据仓库的 AES-GCM / HMAC 密钥。更换口令后旧密文无法解密，请谨慎操作。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleUserPull} disabled={uBusy !== null}>
              <Download className="mr-1 h-4 w-4" /> {uBusy === 'pull' ? '拉取中…' : '拉取用户数据'}
            </Button>
            <Button onClick={handleUserPush} disabled={uBusy !== null}>
              <Upload className="mr-1 h-4 w-4" /> {uBusy === 'push' ? '推送中…' : '加密推送用户数据'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" /> GitHub 平台设置仓（第三库：排版风格 + 认证会话）
            {sTokenSaved ? <Badge className="bg-emerald-500/15 text-emerald-600">凭证已配置</Badge> : <Badge variant="outline">共用用户库凭证</Badge>}
            {uPassSaved ? (
              <Badge className="bg-emerald-500/15 text-emerald-600">
                <Lock className="mr-0.5 h-3 w-3" /> 加密已启用
              </Badge>
            ) : (
              <Badge variant="outline">
                <Unlock className="mr-0.5 h-3 w-3" /> 未设加密口令
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Palette className="h-3.5 w-3.5" /> 平台设置仓</div>
              <div className="mt-1 font-medium">
                {sRepo.owner}/{sRepo.name}
                <span className="ml-1.5 text-xs text-muted-foreground">分支 {sRepo.branch}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">数据目录 db/ · 共 {sFiles.length} 个设置文件（settings + authSessions）</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> 存储内容</div>
              <div className="mt-1 text-xs leading-5">
                · 全站设置 / 排版风格 / 字体字号行距（管理员后台替换后同步）
                <br />· 登录设备会话（身份认证，退出其他设备后同步）
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground"><GitBranch className="h-3.5 w-3.5" /> 三仓分离存储</div>
            <b>内容/代码仓库</b>（{repo.owner}/{repo.name}）存作品与代码、<b>用户数据仓库</b>（{uRepo.owner}/{uRepo.name}）存用户资金与隐私、<b>本设置仓</b>（{sRepo.owner}/{sRepo.name}）存平台配置与认证会话，三者物理隔离、独立加密盐。<br />
            <b>凭证：</b>设置仓复用用户数据仓库的令牌与加密口令（同一管理员账号），但使用<b>独立派生盐</b>（{sRepo.owner}/{sRepo.name}），口令相同密文也不互通，进一步防止跨库破解。
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSettingsPull} disabled={sBusy !== null}>
              <Download className="mr-1 h-4 w-4" /> {sBusy === 'pull' ? '拉取中…' : '拉取平台设置'}
            </Button>
            <Button onClick={handleSettingsPush} disabled={sBusy !== null}>
              <Upload className="mr-1 h-4 w-4" /> {sBusy === 'push' ? '推送中…' : '加密推送平台设置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" /> 一键修改加密口令
            <Badge className="bg-amber-500/15 text-amber-600">推荐</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            输入新口令（≥6 位）后点击下方按钮：系统会<strong className="text-foreground">自动用新口令重新加密推送内容库、用户数据、平台设置三仓</strong>，
            云端旧密文会被新密文覆盖，完成后旧口令立即失效。换设备拉取时只需输入这一个新口令。
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="password"
              className="max-w-xs"
              value={newPassInput}
              onChange={(e) => setNewPassInput(e.target.value)}
              placeholder="输入新口令（≥6 位）"
              autoComplete="off"
            />
            <Button onClick={handleRotatePass} disabled={rotateBusy || newPassInput.trim().length < 6}>
              <RefreshCw className={`mr-1 h-4 w-4 ${rotateBusy ? 'animate-spin' : ''}`} />
              {rotateBusy ? '正在重推三仓…' : '一键修改并重推三仓'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">同步内容清单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-foreground"><Cloud className="h-3.5 w-3.5" /> 内容库文件（{repo.owner}/{repo.name}）</p>
          {cloud.files().map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="font-medium">{f.key}</span>
              <span className="text-xs text-muted-foreground">{f.path}</span>
            </div>
          ))}
          <p className="flex items-center gap-1.5 pt-2 font-medium text-foreground"><Database className="h-3.5 w-3.5" /> 用户数据文件（{uRepo.owner}/{uRepo.name}，独立仓库）</p>
          {cloud.userFiles().map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="font-medium">{f.key}</span>
              <span className="text-xs text-muted-foreground">{f.path}</span>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            拉取会覆盖本地数据（云端为权威）；推送会把本地数据加密后写入对应仓库。每份文件推送前加密签名、拉取时验签解密 + 内容查杀，命中危险载荷或验签失败自动拒收并记录安全日志。用户数据仓库明文文件一律拒收。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
