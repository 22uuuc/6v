// EXPORTS:
//   BookType, BookGenre, BookStatus, UserRole, TxKind, WithdrawStatus
//   IUser, IChapter, IVisualNode, IVisualScript, IComicChapter, IComicPage
//   IBook, IProgress, IShelfEntry, ITx, IWithdrawal, IReview, ISession
//   ISettlement, ISecurityLog, IAuditLog, ISettings, LEVELS, IApplicant, ApplicantStatus
//   PaymentProviderId, IPaymentProvider, IPayTransfer

export type BookType = 'novel' | 'visual' | 'comic' | 'anime';
export type BookGenre =
  | '玄幻' | '都市' | '科幻' | '悬疑' | '古言' | '青春' | '武侠' | '奇幻'
  | '仙侠' | '历史' | '游戏' | '言情' | '轻小说' | '现实';
export type BookStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'offline';
/** 封面视觉风格：日系漫感 / 清新治愈 / 暗夜玄幻 / 经典网文 */
export type CoverStyle = 'anime' | 'fresh' | 'dark' | 'classic';
/** 书名字体 key（COVER_FONTS.value） */
export type CoverFont = 'default' | 'kai' | 'song' | 'hei' | 'li' | 'xing' | 'yuan';
export type UserRole = 'reader' | 'creator' | 'admin';
export type TxKind = 'recharge' | 'subscribe' | 'tip' | 'vip' | 'reward' | 'withdraw' | 'settle';
export type WithdrawStatus = 'pending' | 'done' | 'rejected';
export type SettleStatus = 'pending' | 'approved' | 'rejected';
/** 提现渠道类型 */
export type ChannelType = 'alipay' | 'wechat' | 'bank';
/** 提现渠道审核状态 */
export type ChannelStatus = 'pending' | 'approved' | 'rejected';
/** 充值方式 */
export type RechargeMethod = 'alipay' | 'wechat' | 'bank' | 'cloud';
/** 创作者资质申请状态 */
export type ApplicantStatus = 'pending' | 'approved' | 'rejected';
/** 代付平台 id：微信支付商家转账 / 支付宝转账 / 银行卡代付 */
export type PaymentProviderId = 'wxpay' | 'alipay' | 'bankpay';
/** 代付状态 */
export type PayTransferStatus = 'dispatched' | 'done' | 'failed';

/** 支付/代付平台对接配置（零密钥设计：收款直连支付平台链接/二维码，无需商户密钥；真实资金划转需服务端，前端为配置框架 + 模拟代付） */
export interface IPaymentProvider {
  id: PaymentProviderId;
  label: string;
  enabled: boolean;
  /** 收款接入字段：receiveLink（收款链接）/ receiveQr（收款二维码内容），不再存储商户密钥 */
  fields: Record<string, string>;
  updatedAt?: string;
}

/** 代付记录（模拟真实平台单号与请求摘要） */
export interface IPayTransfer {
  id: string;
  withdrawalId: string;
  userId: string;
  provider: PaymentProviderId;
  amount: number;
  channelLabel: string;
  status: PayTransferStatus;
  tradeNo: string;
  payload: string;
  /** 收款二维码内容（微信/支付宝收款码串，前端渲染为可扫码二维码） */
  qrContent?: string;
  createdAt: string;
}

/** 创作者资质申请：申请开通创作者时提交资质说明 + 首部作品初步发布 */
export interface IApplicant {
  id: string;
  userId: string;
  nickname: string;
  /** 资质说明（为何适合创作/过往经验等） */
  reason: string;
  /** 首部作品信息 */
  workTitle: string;
  workType: BookType;
  workIntro: string;
  status: ApplicantStatus;
  note?: string;
  createdAt: string;
  handledAt?: string;
}

/** 提现渠道：创作者绑定，需管理员审核通过后方可用于提现 */
export interface IWithdrawChannel {
  id: string;
  userId: string;
  type: ChannelType;
  /** 账号（支付宝/微信/银行卡号） */
  account: string;
  /** 收款人姓名 */
  accountName: string;
  /** 开户行（银行卡渠道） */
  bankName?: string;
  status: ChannelStatus;
  note?: string;
  createdAt: string;
}

/** 提现单渠道快照（提交时固化，管理员审核可见） */
export interface IChannelSnapshot {
  type: ChannelType;
  account: string;
  accountName: string;
  bankName?: string;
}

export interface IUser {
  id: string;
  username: string;
  password: string;
  nickname: string;
  role: UserRole;
  vip: boolean;
  vipUntil?: string;
  banned: boolean;
  coins: number;
  /** 可提现余额（书币），收益审核通过后累加 */
  withdrawable: number;
  /** 用户等级 1-6 */
  level: number;
  /** 经验值 */
  exp: number;
  bio?: string;
  /** 隐私设置（读者隐私化） */
  privacy?: IPrivacy;
  /** 账号认证状态：已验证的手机/邮箱（注册/找回密码时完成验证） */
  verified?: { email?: boolean; phone?: boolean };
  /** 认证等级：0 未认证 / 1 基础（邮箱或手机已验）/ 2 完整（邮箱+手机已验） */
  authLevel?: number;
  /** 个性化偏好（字体/字号/行距/阅读主题） */
  prefs?: IUserPrefs;
  createdAt: string;
}

/** 用户个性化偏好（阅读与排版，仅本人可见） */
export interface IUserPrefs {
  /** 阅读字体：system 系统默认 / serif 衬线正文 / rounded 圆润漫画感 */
  fontFamily?: string;
  /** 阅读字号（px） */
  fontSize?: number;
  /** 行距 */
  lineHeight?: number;
  /** 阅读主题：墨夜/纸感/深夜 */
  readerTheme?: 'ink' | 'paper' | 'night';
}

/** 平台排版风格预设（管理员后台可替换，全站生效） */
export type LayoutStyle = 'anime' | 'guofeng' | 'kawaii' | 'fresh' | 'night' | 'warm';

/** 登录会话记录（设备安全：展示登录设备、支持退出其他设备） */
export interface ILoginSession {
  id: string;
  userId: string;
  /** 设备标识（UA 摘要） */
  device: string;
  at: string;
  lastAt: string;
}

/** 读者隐私设置 */
export interface IPrivacy {
  /** 对外隐藏书币余额 */
  hideBalance: boolean;
  /** 对外隐藏最近阅读 */
  hideRecent: boolean;
  /** 对外隐藏书架 */
  hideShelf: boolean;
  /** 对外隐藏收支记录 */
  hideRecords: boolean;
  /** 隐身模式：不展示在线/活跃状态 */
  stealth: boolean;
}

/** 意见反馈（读者 → 平台），含退款工单（refund） */
export interface IFeedback {
  id: string;
  userId: string;
  userName: string;
  type: 'suggest' | 'bug' | 'report' | 'refund' | 'other';
  title: string;
  content: string;
  contact?: string;
  status: 'pending' | 'resolved';
  reply?: string;
  replyAt?: string;
  createdAt: string;
  /** 退款工单结构化信息（type=refund 时携带） */
  refund?: {
    txId: string;
    yuan: number;
    coin: number;
    status: 'none' | 'approved' | 'rejected';
    handledAt?: string;
    handledBy?: string;
  };
}

/** 站内消息（读者 ↔ 管理员/客服） */
export interface IMessage {
  id: string;
  userId: string;
  userName: string;
  sender: 'user' | 'admin';
  text: string;
  createdAt: string;
  read: boolean;
}

export interface IChapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  content: string;
  price: number;
}

export interface IVisualNode {
  id: string;
  scene: string;
  /** 画面人物（person id，确定性生成） */
  char?: string;
  speaker?: string;
  text: string;
  choices: { label: string; next?: string }[];
  ending?: boolean;
  endingTitle?: string;
}

export interface IVisualScript {
  bookId: string;
  startNode: string;
  nodes: IVisualNode[];
}

export interface IComicChapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  pageIds: string[];
  price: number;
}

export interface IComicPage {
  id: string;
  bookId: string;
  chapterId: string;
  index: number;
  scene: string;
  /** 用户上传图片在 IndexedDB 中的 key（存在时优先于 scene） */
  imageKey?: string;
  caption?: string;
  dialogue: string[];
}

export interface IBook {
  id: string;
  type: BookType;
  title: string;
  authorId: string;
  authorName: string;
  genre: BookGenre;
  status: BookStatus;
  coverSeed: string;
  /** 封面视觉风格（未设置时按题材自动推断） */
  coverStyle?: CoverStyle;
  /** 封面来源：svg 程序化封面 / image 本地上传封面 */
  coverType?: 'svg' | 'image';
  /** 书名字体（COVER_FONTS.value，未设置时默认衬线） */
  coverFont?: CoverFont;
  description: string;
  tags: string[];
  serial: 'serial' | 'finished';
  words: number;
  views: number;
  likes: number;
  rating: number;
  createdAt: string;
  chapterPrice: number;
  chapterIds: string[];
  /** 编辑推荐（管理员推送流量） */
  featured?: boolean;
  /** 动漫视频文件在 IndexedDB 中的 key */
  animeKey?: string;
  /** 是否被安全系统隔离 */
  quarantined?: boolean;
}

export interface IProgress {
  userId: string;
  bookId: string;
  chapterId?: string;
  nodeId?: string;
  updatedAt: string;
}

export interface IShelfEntry {
  userId: string;
  bookId: string;
  addedAt: string;
}

export interface ITx {
  id: string;
  userId: string;
  kind: TxKind;
  amount: number;
  coin: number;
  note: string;
  createdAt: string;
  bookId?: string;
  /** 订阅的章节 id（小说/漫画章节粒度，互动/动漫为整本无此字段） */
  chapterId?: string;
  /** 充值方式（recharge 时记录） */
  method?: string;
  /** 充值/代付平台单号（收银台订单号） */
  payNo?: string;
}

export interface IWithdrawal {
  id: string;
  userId: string;
  amount: number;
  status: WithdrawStatus;
  note?: string;
  /** 使用的提现渠道 id */
  channelId?: string;
  /** 渠道快照（提交时固化） */
  channel?: IChannelSnapshot;
  /** 代付平台（发起提现时选择，需平台已对接启用） */
  providerId?: PaymentProviderId;
  /** 代付平台单号（管理员放款时模拟生成） */
  payTradeNo?: string;
  /** 代付状态 */
  payStatus?: PayTransferStatus;
  /** 收款二维码内容（实时下发，扫码收款） */
  payQrContent?: string;
  createdAt: string;
}

export interface IReview {
  id: string;
  bookId: string;
  action: 'approve' | 'reject';
  note?: string;
  createdAt: string;
}

export interface ISession {
  userId: string;
  loginAt: string;
}

/** 收益结算单：订阅/打赏分成先进入待审核，管理员通过后才可提现 */
export interface ISettlement {
  id: string;
  userId: string;
  bookId?: string;
  kind: 'subscribe' | 'tip';
  amount: number;
  note: string;
  status: SettleStatus;
  createdAt: string;
  decidedAt?: string;
}

/** 作品评论：读者互动（支持回复与点赞，作者与管理员可删除） */
export interface IComment {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  content: string;
  likes: number;
  /** 点赞用户 id 列表（防重复赞） */
  likedBy: string[];
  /** 回复的评论 id（为空表示顶层评论） */
  replyToId?: string;
  /** 被回复人的昵称 */
  replyToName?: string;
  createdAt: string;
}

/** 安全日志：内容扫描 / 篡改检测 / 暴力破解 */
export interface ISecurityLog {
  id: string;
  kind: 'xss' | 'suspicious' | 'tamper' | 'attack';
  level: 'warn' | 'danger';
  targetType?: string;
  targetId?: string;
  field?: string;
  snippet?: string;
  message: string;
  status: 'flagged' | 'cleaned' | 'ignored' | 'resolved';
  createdAt: string;
}

/** 审计日志：管理员关键操作留痕 */
export interface IAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target?: string;
  detail?: string;
  createdAt: string;
}

/** 系统设置（管理员可改，影响全站） */
export interface ISettings {
  siteName: string;
  announcement: string;
  vipPrice: number;
  rechargeRate: number;
  subShare: number;
  tipShare: number;
  openRegister: boolean;
  /** 启用的充值方式（用户充值时可选择） */
  rechargeMethods: RechargeMethod[];
  /** 管理安全码（哈希后存储） */
  adminCode: string;
  /** 安全码错误锁定至（时间戳） */
  adminLockedUntil: number;
  /** 安全码连续错误次数 */
  adminFailCount: number;
  /** 开发者白名单（用户名列表）：白名单成员/管理员打开开发者工具不触发反破解告警（正常调试豁免） */
  devWhitelist?: string[];
  /** 平台排版风格（管理员后台可替换，全站生效） */
  layoutStyle?: LayoutStyle;
  /** 平台默认阅读字体 */
  fontFamily?: string;
  /** 平台默认阅读字号（px） */
  fontSize?: number;
  /** 平台默认行距 */
  lineHeight?: number;
}

export interface ILevel {
  level: number;
  name: string;
  need: number;
}

export const LEVELS: ILevel[] = [
  { level: 1, name: '见习书虫', need: 0 },
  { level: 2, name: '青藤读者', need: 200 },
  { level: 3, name: '灯火书客', need: 500 },
  { level: 4, name: '夜航执笔', need: 1000 },
  { level: 5, name: '墨海舵手', need: 2000 },
  { level: 6, name: '传奇书灵', need: 4000 },
];

export const GENRES: BookGenre[] = [
  '玄幻', '都市', '科幻', '悬疑', '古言', '青春', '武侠', '奇幻',
  '仙侠', '历史', '游戏', '言情', '轻小说', '现实',
];

/** 封面风格选项（创作者选择用） */
export const COVER_STYLES: { value: CoverStyle; label: string; desc: string }[] = [
  { value: 'anime', label: '日系漫感', desc: '柔彩渐变、星光点缀，轻小说与动漫风' },
  { value: 'fresh', label: '清新治愈', desc: '水彩浅调、明快通透，青春治愈系' },
  { value: 'dark', label: '暗夜玄幻', desc: '深底描金、冷光流转，玄幻仙侠武侠' },
  { value: 'classic', label: '经典网文', desc: '沉稳暖调、红金描边，经典小说质感' },
];

/** 书名字体选项（创作者选择用）：系统内置中文字体栈，无需下载字体文件 */
export const COVER_FONTS: { value: CoverFont; label: string; font: string; desc: string }[] = [
  { value: 'default', label: '默认衬线', font: 'Georgia, "Times New Roman", serif', desc: '常规书卷气' },
  { value: 'kai', label: '楷体', font: '"KaiTi", "STKaiti", "楷体", serif', desc: '手写温润，古典味' },
  { value: 'song', label: '宋体', font: '"SimSun", "宋体", serif', desc: '端正印刷，出版感' },
  { value: 'hei', label: '黑体', font: '"PingFang SC", "Microsoft YaHei", sans-serif', desc: '干脆利落，现代感' },
  { value: 'li', label: '隶书', font: '"LiSu", "隶书", serif', desc: '浑厚古朴，历史厚重' },
  { value: 'xing', label: '行楷', font: '"Xingkai SC", "华文行楷", serif', desc: '灵动潇洒，江湖气' },
  { value: 'yuan', label: '圆体', font: '"Yuanti SC", "华文圆体", sans-serif', desc: '圆润亲和，治愈感' },
];

export const SCENES = [
  'night-city',
  'mountain',
  'forest',
  'snow',
  'sea',
  'desert',
  'space',
  'street',
  'campus',
  'tea-house',
  'kitchen',
  'ghost',
] as const;

export const SCENE_NAMES: Record<string, string> = {
  'night-city': '都市夜',
  mountain: '云海仙山',
  forest: '深林',
  snow: '雪原',
  sea: '海边',
  desert: '荒漠',
  space: '星轨',
  street: '旧街巷',
  campus: '校园',
  'tea-house': '古楼茶馆',
  kitchen: '烟火食堂',
  ghost: '雾夜幽巷',
};
