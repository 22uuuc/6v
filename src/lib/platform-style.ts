// EXPORTS: PLATFORM_STYLES / FONT_STYLES / applyPlatformStyle
// 平台排版风格库：管理员后台可替换（全站生效）。
// 每个风格是「配色 + 圆角 + 字体 + 氛围装饰」的完整设计体系（不只是换颜色）：
//   - vars：覆盖 :root CSS 变量（Tailwind 主题色跟随变化）
//   - radius：全站圆角（超大圆角/古典圆角等）
//   - fontKey：该风格默认阅读字体
//   - atmosphere：氛围装饰层（Layout 渲染）：aurora 星夜光点 / guofeng 国风祥云花瓣 / kawaii 清新叶子云朵

import type { LayoutStyle } from '@/lib/types';

export type AtmosphereType = 'aurora' | 'guofeng' | 'kawaii';

export interface IPlatformStyle {
  key: LayoutStyle;
  label: string;
  desc: string;
  /** 覆盖的 CSS 变量（关键色，其余沿用默认） */
  vars: Record<string, string>;
  /** 全站圆角（CSS 值） */
  radius: string;
  /** 该风格默认字体（可被平台/个人设置覆盖） */
  fontKey: string;
  /** 氛围装饰层类型 */
  atmosphere: AtmosphereType;
  /** 风格标签（管理面板展示） */
  tags: string[];
}

/** 六种平台排版风格：星夜动漫（默认）/ 国风宣纸 / 清新漫感 / 深海暗夜 / 暖橙灯下 / 清新绿 */
export const PLATFORM_STYLES: Record<LayoutStyle, IPlatformStyle> = {
  anime: {
    key: 'anime',
    label: '星夜动漫',
    desc: '深紫星空基底 · 鎏金灯暖 · 朱红点缀（当前默认）',
    vars: {
      '--background': 'hsl(225 32% 7%)',
      '--foreground': 'hsl(42 24% 92%)',
      '--card': 'hsl(222 26% 11%)',
      '--primary': 'hsl(267 82% 70%)',
      '--primary-foreground': 'hsl(225 32% 9%)',
      '--accent': 'hsl(6 72% 55%)',
      '--ring': 'hsl(267 82% 70%)',
      '--sidebar-primary': 'hsl(267 82% 70%)',
    },
    radius: '0.75rem',
    fontKey: 'system',
    atmosphere: 'aurora',
    tags: ['紫粉极光', '飘落光点', '卡片流光'],
  },
  guofeng: {
    key: 'guofeng',
    label: '国风·宣纸朱砂',
    desc: '藏青墨底 · 宣纸纹理 · 朱砂红主色 · 哑光金细节',
    vars: {
      '--background': 'hsl(218 42% 9%)',
      '--foreground': 'hsl(42 30% 90%)',
      '--card': 'hsl(214 36% 12%)',
      '--card-foreground': 'hsl(42 30% 90%)',
      '--primary': 'hsl(4 62% 58%)',
      '--primary-foreground': 'hsl(42 34% 96%)',
      '--accent': 'hsl(45 48% 55%)',
      '--accent-foreground': 'hsl(218 42% 9%)',
      '--info': 'hsl(45 48% 55%)',
      '--ring': 'hsl(4 62% 58%)',
      '--sidebar-primary': 'hsl(45 48% 55%)',
    },
    radius: '0.5rem',
    fontKey: 'serif',
    atmosphere: 'guofeng',
    tags: ['祥云浮动', '朱砂花瓣', '水墨光晕'],
  },
  kawaii: {
    key: 'kawaii',
    label: '清新漫感',
    desc: '薄荷绿 · 天空蓝 · 蜜桃粉 · 超大圆角 · 手写感字体',
    vars: {
      '--background': 'hsl(160 45% 94%)',
      '--foreground': 'hsl(170 18% 18%)',
      '--card': 'hsl(0 0% 100%)',
      '--card-foreground': 'hsl(170 18% 18%)',
      '--popover': 'hsl(0 0% 100%)',
      '--popover-foreground': 'hsl(170 18% 18%)',
      '--primary': 'hsl(155 48% 42%)',
      '--primary-foreground': 'hsl(0 0% 100%)',
      '--secondary': 'hsl(205 90% 92%)',
      '--secondary-foreground': 'hsl(205 60% 30%)',
      '--muted': 'hsl(165 30% 90%)',
      '--muted-foreground': 'hsl(165 15% 42%)',
      '--accent': 'hsl(345 85% 74%)',
      '--accent-foreground': 'hsl(345 60% 30%)',
      '--border': 'hsl(160 30% 84%)',
      '--input': 'hsl(160 30% 84%)',
      '--ring': 'hsl(155 48% 42%)',
      '--sidebar': 'hsl(160 40% 92%)',
      '--sidebar-foreground': 'hsl(170 18% 18%)',
      '--sidebar-primary': 'hsl(155 48% 42%)',
    },
    radius: '1.25rem',
    fontKey: 'rounded',
    atmosphere: 'kawaii',
    tags: ['超大圆角', '手写字体', '叶子云朵'],
  },
  night: {
    key: 'night',
    label: '深海暗夜',
    desc: '墨蓝深底 · 冷蓝主色 · 静谧沉浸',
    vars: {
      '--background': 'hsl(220 40% 6%)',
      '--foreground': 'hsl(210 30% 94%)',
      '--card': 'hsl(218 32% 10%)',
      '--primary': 'hsl(205 92% 62%)',
      '--primary-foreground': 'hsl(220 40% 8%)',
      '--accent': 'hsl(340 72% 58%)',
      '--ring': 'hsl(205 92% 62%)',
      '--sidebar-primary': 'hsl(205 92% 62%)',
    },
    radius: '0.75rem',
    fontKey: 'system',
    atmosphere: 'aurora',
    tags: ['冷蓝光晕', '静谧沉浸'],
  },
  warm: {
    key: 'warm',
    label: '暖橙灯下',
    desc: '深棕暖底 · 橙金主色 · 书卷灯下',
    vars: {
      '--background': 'hsl(28 30% 9%)',
      '--foreground': 'hsl(38 26% 92%)',
      '--card': 'hsl(26 24% 13%)',
      '--primary': 'hsl(27 88% 58%)',
      '--primary-foreground': 'hsl(28 30% 9%)',
      '--accent': 'hsl(358 70% 58%)',
      '--ring': 'hsl(27 88% 58%)',
      '--sidebar-primary': 'hsl(27 88% 58%)',
    },
    radius: '0.75rem',
    fontKey: 'system',
    atmosphere: 'aurora',
    tags: ['暖金光斑', '灯下书卷'],
  },
  fresh: {
    key: 'fresh',
    label: '清新绿',
    desc: '浅底柔和 · 草木绿主色 · 干净通透',
    vars: {
      '--background': 'hsl(152 20% 96%)',
      '--foreground': 'hsl(160 18% 14%)',
      '--card': 'hsl(0 0% 100%)',
      '--card-foreground': 'hsl(160 18% 14%)',
      '--primary': 'hsl(150 58% 34%)',
      '--primary-foreground': 'hsl(0 0% 100%)',
      '--accent': 'hsl(24 78% 52%)',
      '--ring': 'hsl(150 58% 34%)',
      '--muted-foreground': 'hsl(160 10% 46%)',
    },
    radius: '1rem',
    fontKey: 'system',
    atmosphere: 'kawaii',
    tags: ['草木绿', '圆润卡片'],
  },
};

/** 阅读字体选项（平台默认与用户个性化共用） */
export const FONT_STYLES: { key: string; label: string; stack: string }[] = [
  { key: 'system', label: '系统默认', stack: "'LarkHackSafariFont','PingFang SC','Microsoft Yahei','sans-serif'" },
  { key: 'serif', label: '衬线正文（国风宋体感）', stack: "'Noto Serif SC','Songti SC','SimSun','Georgia','serif'" },
  { key: 'rounded', label: '手写圆体（漫画感）', stack: "'Comic Sans MS','Yuanti SC','YouYuan','PingFang SC','sans-serif'" },
];

export function fontStack(key?: string): string {
  return FONT_STYLES.find((f) => f.key === key)?.stack ?? FONT_STYLES[0].stack;
}

/** 应用平台排版风格到 :root（覆盖 CSS 变量 + 圆角 + 字体 + 氛围类型）；返回清理函数 */
export function applyPlatformStyle(
  styleKey?: LayoutStyle,
  fontKey?: string,
  fontSize?: number,
  lineHeight?: number,
): () => void {
  const st = PLATFORM_STYLES[styleKey ?? 'anime'] ?? PLATFORM_STYLES.anime;
  const root = document.documentElement;
  const saved: [string, string][] = [];
  for (const [k, v] of Object.entries(st.vars)) {
    saved.push([k, root.style.getPropertyValue(k)]);
    root.style.setProperty(k, v);
  }
  saved.push(['--radius', root.style.getPropertyValue('--radius')]);
  root.style.setProperty('--radius', st.radius);
  saved.push(['--font-sans', root.style.getPropertyValue('--font-sans')]);
  root.style.setProperty('--font-sans', fontStack(fontKey ?? st.fontKey));
  saved.push(['--atmosphere-type', root.style.getPropertyValue('--atmosphere-type')]);
  root.style.setProperty('--atmosphere-type', st.atmosphere);
  saved.push(['--reader-font-size', root.style.getPropertyValue('--reader-font-size')]);
  root.style.setProperty('--reader-font-size', `${fontSize ?? 18}px`);
  saved.push(['--reader-line-height', root.style.getPropertyValue('--reader-line-height')]);
  root.style.setProperty('--reader-line-height', String(lineHeight ?? 1.9));
  return () => {
    for (const [k, v] of saved) {
      if (v) root.style.setProperty(k, v); else root.style.removeProperty(k);
    }
  };
}
