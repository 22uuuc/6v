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
export type CoverStyle = 'anime' | 'fresh' | 'dark' | 'classic';
export type CoverFont = 'default' | 'kai' | 'song' | 'hei' | 'li' | 'xing' | 'yuan';
export type UserRole = 'reader' | 'creator' | 'admin';
export type TxKind = 'recharge' | 'subscribe' | 'tip' | 'vip' | 'reward' | 'withdraw' | 'settle';
export type WithdrawStatus = 'pending' | 'done' | 'rejected';
export type SettleStatus = 'pending' | 'approved' | 'rejected';
export type ChannelType = 'alipay' | 'wechat' | 'bank';
export type ChannelStatus = 'pending' | 'approved' | 'rejected';
export type RechargeMethod = 'alipay' | 'wechat' | 'bank' | 'cloud';
export type ApplicantStatus = 'pending' | 'approved' | 'rejected';
export type PaymentProviderId = 'wxpay' | 'alipay' | 'bankpay';
export type PayTransferStatus = 'dispatched' | 'done' | 'failed';

export interface IPaymentProvider {
  id: PaymentProviderId;
  label: string;
  enabled: boolean;
  fields: Record<string, string>;
  updatedAt?: string;
}

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
  qrContent?: string;
  createdAt: string;
}

export interface IApplicant {
  id: string;
  userId: string;
  nickname: string;
  reason: string;
  workTitle: string;
  workType: BookType;
  workIntro: string;
  status: ApplicantStatus;
  note?: string;
  createdAt: string;
  handledAt?: string;
}

export interface IWithdrawChannel {
  id: string;
  userId: string;
  type: ChannelType;
  account: string;
  accountName: string;
  bankName?: string;
  status: ChannelStatus;
  note?: string;
  createdAt: string;
}

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
  withdrawable: number;
  level: number;
  exp: number;
  bio?: string;
  privacy?: IPrivacy;
  createdAt: string;
}

export interface IPrivacy {
  hideBalance: boolean;
  hideRecent: boolean;
  hideShelf: boolean;
  hideRecords: boolean;
  stealth: boolean;
}

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
}

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
  coverStyle?: CoverStyle;
  coverType?: 'svg' | 'image';
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
  featured?: boolean;
  animeKey?: string;
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
  chapterId?: string;
  method?: string;
}

export interface IWithdrawal {
  id: string;
  userId: string;
  amount: number;
  status: WithdrawStatus;
  note?: string;
  channelId?: string;
  channel?: IChannelSnapshot;
  providerId?: PaymentProviderId;
  payTradeNo?: string;
  payStatus?: PayTransferStatus;
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

export interface IComment {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  content: string;
  likes: number;
  likedBy: string[];
  replyToId?: string;
  replyToName?: string;
  createdAt: string;
}

export interface ISecurityLog {
  id: string;
  kind: 'xss' | 'suspicious' | 'tamper' | 'attack';
  level: 'warn' | 'danger';
  targetType?: string;
  targetId?: string;
  field?: string;
  snippet?: string;
  message: string;
  status: 'flagged' | 'cleaned' | 'ignored';
  createdAt: string;
}

export interface IAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target?: string;
  detail?: string;
  createdAt: string;
}

export interface ISettings {
  siteName: string;
  announcement: string;
  vipPrice: number;
  rechargeRate: number;
  subShare: number;
  tipShare: number;
  openRegister: boolean;
  rechargeMethods: RechargeMethod[];
  adminCode: string;
  adminLockedUntil: number;
  adminFailCount: number;
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

export const COVER_STYLES: { value: CoverStyle; label: string; desc: string }[] = [
  { value: 'anime', label: '日系漫感', desc: '柔彩渐变、星光点缀，轻小说与动漫风' },
  { value: 'fresh', label: '清新治愈', desc: '水彩浅调、明快通透，青春治愈系' },
  { value: 'dark', label: '暗夜玄幻', desc: '深底描金、冷光流转，玄幻仙侠武侠' },
  { value: 'classic', label: '经典网文', desc: '沉稳暖调、红金描边，经典小说质感' },
];

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
