# 墨影书城 · 服务端化改造接口映射表（工作文档）

> 用途：api.ts（约 2200 行，约 140 个同步方法）→ REST 后端的迁移映射。
> 规格来源：《Trae开发需求-墨影书城服务端化改造.md》《墨影书城服务端迁移方案.md》（attachments 已精读）。
> 状态：Phase 0（映射设计）完成，Phase 1-5 未开始。

## 0. 架构决策（已定）

- 后端：`moying/server/` 独立工程，Node.js + TypeScript + Express + Prisma + SQLite（可切 PostgreSQL）+ JWT(access 30min + refresh 7d) + bcrypt(cost 10)。
- 端口 8787；Vite dev 代理 `/api` → `http://localhost:8787`。
- **前端 api.ts 保持唯一导入面**，内部三层：
  1. **同步读**：启动时 `GET /api/bootstrap` 拉公开快照（settings + published 书目元数据 + 章节目录【不含正文】+ featured），缓存内存+localStorage，`useDataVersion` 触发重渲染。页面 `api.publishedBooks()` 等同步方法读缓存，**页面层零改动**。
  2. **异步写**：付费/充值/解锁/上传/管理/提现等全部改 async HTTP。调用点（点击处理器）改 await + toast，改动集中在 ~20 个页面的事件处理器。
  3. **内容按需**：`chaptersOf()` 只回目录（title/price/locked），正文经 `GET /api/chapters/:id/content` 校验解锁后下发，未解锁 403，正文不进 bundle。
- `unlocks` 新表存解锁关系（userId+bookId+kind+targetId），`isUnlocked` 服务端判定；目录接口直接带 locked 字段。
- localStorage 仅存：JWT 对、主题/排版偏好、公开快照缓存。余额/VIP/解锁一律服务端权威。
- guard.ts/store.ts/cloud.ts：降级为体验保护与管理员备份通道，不再承担安全职责（云同步按 memory 硬约束保留匿名只读拉取框架，业务数据以服务端为准）。
- 金额全部整数书币；分成（subShare/tipShare）、汇率（rechargeRate）、VIP 价由 settings 表控制。
- 防刷：单笔上限、频控（滑动窗口内存表）、负数/伪造拦截；支付回调 HMAC-SHA256 验签 + payNo 唯一约束幂等。

## 1. Prisma 模型（22 张表）

User, Book, Chapter, VisualScript, ComicChapter, ComicPage, Tx, Unlock, Settlement,
Withdrawal, WithdrawChannel, Applicant, Review, Comment, SecurityLog, AuditLog,
Settings(单行), Feedback, Message, ShelfEntry, Progress, LoginSession,
PaymentProvider, PayTransfer, RefreshToken, DailyTask(签到/阅读任务), RateLimit(频控)。

字段与 `src/lib/types.ts` 一一对应（IUser/IBook/IChapter/ITx/...），主键沿用现有 id 字符串。
密码字段改为 bcrypt 哈希；IUser 下发前端时剥离 password（替换为占位）。

## 2. 方法 → 接口映射（api.ts 行号 → REST）

### 2.1 认证与会话（L306-480）
| 方法 | 接口 | 说明 |
|---|---|---|
| login | POST /api/auth/login | 返回 {accessToken, refreshToken, user} |
| register | POST /api/auth/register | bcrypt 入库 |
| logout | POST /api/auth/logout | refresh 拉黑 |
| 刷新 | POST /api/auth/refresh | access 过期静默刷新 |
| thirdPartyLogin | POST /api/auth/third | 演示实现，服务端建号 |
| recordSession/mySessions/killOtherSessions | GET/DELETE /api/auth/sessions* | 登录设备 |
| verifyEmail/verifyPhone | POST /api/auth/verify | 演示验证 |
| getPrefs/setPrefs | GET/PUT /api/users/me/prefs | |
| getUser/allUsers/updateProfile/setRole | /api/users/* | setRole 需 admin |
| changePassword | POST /api/users/me/password | 校验旧密码 |
| requestResetCode/resetPassword | POST /api/auth/reset-request / reset | 演示码服务端下发 |

### 2.2 钱包与付费（核心，L1229-1460）
| 方法 | 接口 | 说明 |
|---|---|---|
| recharge | POST /api/wallet/recharge/order → POST /api/wallet/recharge/callback | 创建订单+模拟回调验签幂等入账 |
| payChapter | POST /api/wallet/unlock/chapter | 事务：查余额→扣币→Tx→Unlock→Settlement(作者分成) |
| unlockVisual | POST /api/wallet/unlock/visual | 全本解锁 |
| payComic | POST /api/wallet/unlock/comic | 漫画单话 |
| buyVip | POST /api/wallet/vip | vipPrice 币/30天 |
| tip | POST /api/wallet/tip | 正数校验+分成 |
| txsOf | GET /api/wallet/me | 余额+流水 |
| creditAuthor | （内部） | 服务端事务内完成，无独立接口 |
| adjustCoins/setVip | POST /api/admin/users/:id/coins / vip | admin |
| isUnlocked | GET /api/books/:id/chapters 响应内 locked + 正文接口双重校验 | |

### 2.3 内容与阅读（L763-1163）
| 方法 | 接口 | 说明 |
|---|---|---|
| publishedBooks/allBooks/creatorBooks/getBook/featuredBooks | GET /api/books*、/api/bootstrap | 公开快照 |
| createBook | POST /api/creator/books | interceptPayload 三层扫描迁服务端 |
| updateBook/updateBookInfo/setBookStatus/deleteBook/setFeatured/quarantine | PATCH/POST /api/creator/books/:id*、/api/admin/* | |
| addView | POST /api/books/:id/view | |
| chaptersOf | GET /api/books/:id/chapters | 含 locked，不含 content |
| getChapter + 正文 | GET /api/chapters/:id/content | **403 核心接口** |
| saveChapters | PUT /api/creator/books/:id/chapters | 作者或 admin |
| visualScript/saveVisualScript | GET/PUT /api/creator/books/:id/visual | 正文节点按需下发同 403 |
| comicChapters/comicPages | GET /api/books/:id/comic、GET /api/comics/:chapterId/pages | 校验解锁 |
| saveComic | PUT /api/creator/books/:id/comic | |
| scanBookContent/scanAll | POST /api/admin/security/scan | |

### 2.4 书架/进度/签到/评论（L1165-1593）
shelfOf/inShelf/addShelf/removeShelf → /api/shelf*；getProgress/saveProgress/recentReads → /api/progress*；
checkin/checkinInfo/markReadTask → /api/tasks/*（DailyTask 表）；commentsOf/addComment/toggleCommentLike/deleteComment → /api/books/:id/comments*；
bookHasUpdate/rankBooks → 快照计算（服务端下发）。

### 2.5 创作者与提现（L538-668、L1665-1961）
applyCreator/myApplication/allApplications/decideApplication → /api/creator/apply*；
creatorStats/creatorIncomeTrend → GET /api/creator/stats、/trend；
allSettlements/settlementsOf/decideSettlement → /api/settlements*；
requestWithdraw（二次验证+风控+状态机）/withdrawalsOf/allWithdrawals/decideWithdrawal → /api/withdrawals*；
myChannels/allChannels/saveChannel/decideChannel → /api/channels*；
paymentProviders/savePaymentProvider/payTransfers/simulateTransfer → /api/payments/*。

### 2.6 管理后台（L706-761、L2155-2205）
getSettings/setSettings → GET/PUT /api/settings；
ensureAdminCode/verifyAdminCode/adminLockedUntil → /api/admin/unlock*（服务端锁 10 分钟；邮箱验证码解锁通道后续由服务端 SMTP 直发，替代 unlock-mailer 工作流）；
adminStats → GET /api/admin/stats；reviewsOf → GET /api/admin/reviews；
SecurityLog/AuditLog → /api/admin/security/logs、/api/admin/audit；
封禁 setBanned → POST /api/admin/users/:id/ban。

### 2.7 隐私/反馈/消息（L1963-2153）
savePrivacy/clearHistory → /api/users/me/privacy、/history；
submitFeedback/myFeedback/adminFeedback/replyFeedback/decideRefund → /api/feedback*；
sendMessage/myMessages/adminMessages/adminReply/markSupportRead → /api/messages*；
realtimeRecharges → GET /api/admin/recharges/recent。

## 3. 前端改造面（页面层异步化清单）

- 阅读类 5 页（Reader/Visual/Comic/Dialogue/Game）：内容改 `useEffect` + fetch，403 时复用现有未解锁弹窗。
- 付费类调用点：BookDetailPage、ReaderPage、ComicPage、VisualPage、充值/钱包/作者页的按钮处理器（约 15 处）→ await + 按 ok 分支 toast。
- 上传类 6 页：提交处 await createBook/saveChapters/saveComic/saveVisualScript。
- 管理后台 11 页：操作处理器 await（AdminBooks/AdminUsers/AdminSecurity/AdminCloudSync/AdminWallet/AdminWithdraw/AdminSettings/AdminApplications/AdminFeedback/AdminSupport/AdminSettlement）。
- AuthPage/ShelfPage/ProfilePage/TasksPage/RankPage：登录/书架/进度/签到走 HTTP。
- api.ts 内保留 `fetchChapterContent`、`initServerSync`、token 管理新内部模块 `http.ts`（fetch 封装：自动带 Authorization、401 刷 token、统一错误）。

## 4. 种子迁移

- `server/prisma/seed.ts`：读 `src/data/seed.ts` 导出的 buildSeed()（抽为共享 JSON 或复制），用户密码全部 bcrypt 重哈希（admin/admin123、其余 123456），books/chapters/comic/visual/comments/txs/channels/settings 全量入库。
- 验收演示数据：admin/admin123 可登录，余额 99999，六类作品齐全。

## 5. 验收清单（DoD，规格原文）

1. 控制台/改前端无法加币、免解锁读正文；未解锁正文接口 403。
2. 充值回调验签+幂等，重复回调不重复入账。
3. 浏览器全流程：注册→充值→解锁阅读→打赏→提现申请→管理员审核→收益到账。
4. admin/admin123 等演示账号可用。
5. 现有页面功能无缺失（六类作品/审核/收益/充值/VIP/安全码/隐私/反馈/客服）。
6. tsc/eslint/vitest/build 全绿 + 无头 Edge 全流程实测。
