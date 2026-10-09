// EXPORTS: coverSVG, sceneSVG, comicPageSVG, avatarSVG, posterSVG

// 全部为确定性纯函数：同 seed 永远产出同图，可在 render 期安全调用。
import { makeRand } from '@/lib/rand';

type Opts = { w?: number; h?: number; width?: number; height?: number };

const FONT = "sans-serif";

/** 中文字符串按长度折行 */
function wrapCJK(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (cur.length >= max) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** SVG/XML 文本转义：防止用户可控文本（昵称/书名/对话/旁白）注入 HTML/SVG（存储型 XSS） */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _defs(id: string, body: string): string {
  return `<defs>${body}<clipPath id="clip-${id}"><rect x="0" y="0" width="100%" height="100%"/></clipPath></defs>`;
}

/* ---------------- 场景画师 ---------------- */

interface IArt {
  sky: string; // 渐变 id
  paint: string; // 场景元素
  glow?: string; // 点缀元素（星/雪/雾）
}

function paintScene(scene: string, seed: string, w: number, h: number): IArt {
  const r = makeRand(seed);
  const stars = () => {
    let s = '';
    for (let i = 0; i < 42; i++) {
      const x = r.range(0, w);
      const y = r.range(0, h * 0.55);
      const rad = r.range(0.6, 1.8);
      const op = r.range(0.25, 0.9);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${op.toFixed(2)}"/>`;
    }
    return s;
  };
  const moon = (x: number, y: number, rr: number, color = '#f3e5b8') =>
    `<circle cx="${x}" cy="${y}" r="${rr}" fill="${color}" opacity="0.95"/><circle cx="${x - rr * 0.35}" cy="${y - rr * 0.3}" r="${rr * 0.82}" fill="${sceneSky(scene)}" opacity="0.9"/>`;
  const city = (base: number, color: string, lit: boolean) => {
    let s = '';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const bw = w / n;
      const x = i * bw;
      const bh = r.range(h * 0.18, h * 0.42);
      const y = base - bh;
      s += `<rect x="${x}" y="${y}" width="${bw + 2}" height="${h - y}" fill="${color}"/>`;
      if (lit) {
        for (let k = 0; k < 8; k++) {
          const wx = x + r.range(4, bw - 8);
          const wy = y + r.range(6, bh - 6);
          if (r.next() > 0.45) {
            s += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="3" height="4" fill="#ffd98a" opacity="${r.range(0.3, 0.95).toFixed(2)}"/>`;
          }
        }
      }
    }
    return s;
  };
  const mountains = (base: number, color: string, jag: number) => {
    let s = '';
    let x = 0;
    while (x < w + 60) {
      const peak = base - r.range(60, 160) * jag;
      s += `<path d="M${x} ${base} L${x + r.range(40, 80)} ${peak.toFixed(1)} L${x + r.range(90, 140)} ${base}" fill="${color}"/>`;
      x += r.range(70, 130);
    }
    return s;
  };
  const trees = (base: number, color: string, n: number, size = 1) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = r.range(0, w);
      const th = r.range(30, 70) * size;
      const tw = th * 0.42;
      s += `<path d="M${x.toFixed(1)} ${base} L${(x + tw).toFixed(1)} ${(base - th).toFixed(1)} L${(x - tw).toFixed(1)} ${(base - th).toFixed(1)} Z" fill="${color}"/>`;
      s += `<rect x="${(x - 2).toFixed(1)}" y="${(base - 10).toFixed(1)}" width="4" height="12" fill="${color}"/>`;
    }
    return s;
  };
  const waves = (base: number, color: string, n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const y = base + i * r.range(8, 14);
      s += `<path d="M0 ${y} Q${w * 0.25} ${y - 6} ${w * 0.5} ${y} T${w} ${y}" stroke="${color}" fill="none" stroke-width="1.2" opacity="${(0.7 - i * 0.08).toFixed(2)}"/>`;
    }
    return s;
  };
  const fog = (color: string) => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const y = r.range(h * 0.4, h * 0.95);
      s += `<ellipse cx="${r.range(0, w)}" cy="${y.toFixed(1)}" rx="${r.range(180, 320)}" ry="${r.range(16, 40)}" fill="${color}" opacity="${(0.12 + i * 0.05).toFixed(2)}"/>`;
    }
    return s;
  };
  const snowflakes = () => {
    let s = '';
    for (let i = 0; i < 50; i++) {
      s += `<circle cx="${r.range(0, w)}" cy="${r.range(0, h)}" r="${r.range(0.8, 2.4).toFixed(1)}" fill="#fff" opacity="${r.range(0.25, 0.8).toFixed(2)}"/>`;
    }
    return s;
  };

  switch (scene) {
    case 'night-city': {
      const sky = 'sky-nc';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          stars() +
          moon(w * 0.76, h * 0.16, 26) +
          city(h * 0.78, '#101623', true) +
          city(h * 0.86, '#0b1019', true) +
          `<rect x="0" y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="#070b12"/>` +
          `<ellipse cx="${w * 0.18}" cy="${h * 0.86}" rx="52" ry="14" fill="#ffd98a" opacity="0.28"/>` +
          `<rect x="${w * 0.16}" y="${h * 0.62}" width="6" height="${h * 0.24}" fill="#2a2f3a"/>` +
          `<circle cx="${w * 0.18}" cy="${h * 0.6}" r="7" fill="#ffd98a" opacity="0.9"/>`,
        glow: '',
      };
    }
    case 'mountain': {
      const sky = 'sky-mt';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          mountains(h * 0.62, '#3a4a5e', 1) +
          mountains(h * 0.7, '#2c3a4c', 0.8) +
          mountains(h * 0.8, '#1d2836', 0.7) +
          `<circle cx="${w * 0.5}" cy="${h * 0.3}" r="30" fill="#f6e7c1" opacity="0.9"/>` +
          `<circle cx="${w * 0.5}" cy="${h * 0.3}" r="26" fill="url(#${sky})" opacity="0.75"/>` +
          `<path d="M0 ${h * 0.82} Q${w * 0.3} ${h * 0.76} ${w * 0.6} ${h * 0.82} T${w} ${h * 0.8}" fill="none" stroke="#8fa3b5" stroke-width="10" opacity="0.35"/>` +
          trees(h * 0.82, '#101a26', 7, 0.9) +
          trees(h * 0.88, '#0a121c', 5, 0.6),
        glow: '',
      };
    }
    case 'forest': {
      const sky = 'sky-fr';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<circle cx="${w * 0.7}" cy="${h * 0.2}" r="24" fill="#eaf3dc" opacity="0.8"/>` +
          `<path d="M0 ${h} L0 ${h * 0.55} L${w * 0.12} ${h * 0.42} L${w * 0.24} ${h * 0.55} L${w * 0.24} ${h} Z" fill="#0f2a20"/>` +
          `<path d="M${w * 0.22} ${h} L${w * 0.22} ${h * 0.5} L${w * 0.38} ${h * 0.38} L${w * 0.52} ${h * 0.5} L${w * 0.52} ${h} Z" fill="#14362a"/>` +
          `<path d="M${w * 0.5} ${h} L${w * 0.5} ${h * 0.52} L${w * 0.66} ${h * 0.4} L${w * 0.8} ${h * 0.52} L${w * 0.8} ${h} Z" fill="#0e2419"/>` +
          `<path d="M${w * 0.76} ${h} L${w * 0.76} ${h * 0.5} L${w * 0.92} ${h * 0.38} L${w} ${h * 0.48} L${w} ${h} Z" fill="#123027"/>` +
          `<rect x="${w * 0.3}" y="${h * 0.24}" width="3" height="${h * 0.7}" fill="#fff" opacity="0.16"/>` +
          `<rect x="${w * 0.66}" y="${h * 0.3}" width="4" height="${h * 0.62}" fill="#fff" opacity="0.13"/>` +
          `<ellipse cx="${w * 0.6}" cy="${h * 0.78}" rx="60" ry="18" fill="#cfe3d0" opacity="0.08"/>`,
        glow: '',
      };
    }
    case 'snow': {
      const sky = 'sky-sn';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<circle cx="${w * 0.2}" cy="${h * 0.18}" r="22" fill="#fdf6e3" opacity="0.9"/>` +
          mountains(h * 0.68, '#c9d4dd', 0.7) +
          `<rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="#eef3f6"/>` +
          trees(h * 0.72, '#7d8f9c', 4, 0.8) +
          `<path d="M${w * 0.5} ${h * 0.6} q-4 -14 -2 -18 q2 -4 4 -10 q4 6 3 12 q6 -2 5 6 q-2 6 -10 10 Z" fill="#5a6b77"/>` +
          `<rect x="${w * 0.66}" y="${h * 0.5}" width="90" height="60" rx="4" fill="#8a5a3b" opacity="0.85"/>` +
          `<path d="M${w * 0.66} ${h * 0.5} L${w * 0.76} ${h * 0.42} L${w * 0.86} ${h * 0.5} Z" fill="#6e462c"/>` +
          `<rect x="${w * 0.68}" y="${h * 0.56}" width="12" height="14" fill="#ffd98a" opacity="0.85"/>`,
        glow: snowflakes(),
      };
    }
    case 'sea': {
      const sky = 'sky-sea';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          stars() +
          moon(w * 0.78, h * 0.18, 24) +
          `<rect x="0" y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="#0c1a2e"/>` +
          waves(h * 0.6, '#4d6f95', 6) +
          `<ellipse cx="${w * 0.78}" cy="${h * 0.6}" rx="70" ry="10" fill="#f3e5b8" opacity="0.16"/>` +
          `<rect x="${w * 0.08}" y="${h * 0.28}" width="10" height="${h * 0.42}" fill="#2a333f"/>` +
          `<rect x="${w * 0.04}" y="${h * 0.22}" width="18" height="${h * 0.1}" rx="4" fill="#3a4550"/>` +
          `<rect x="${w * 0.09}" y="${h * 0.24}" width="4" height="26" fill="#ffd98a" opacity="0.9"/>` +
          `<circle cx="${w * 0.06}" cy="${h * 0.2}" r="26" fill="#ffd98a" opacity="0.35"/>` +
          `<path d="M${w * 0.1} ${h * 0.98} q-8 -14 0 -20 q8 -10 6 -24 q-4 10 -12 12 q-10 2 -8 16 q2 10 14 16 Z" fill="#101c2e"/>`,
        glow: '',
      };
    }
    case 'desert': {
      const sky = 'sky-ds';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<circle cx="${w * 0.5}" cy="${h * 0.28}" r="34" fill="#fff3d6" opacity="0.9"/>` +
          `<path d="M0 ${h * 0.7} Q${w * 0.25} ${h * 0.6} ${w * 0.5} ${h * 0.7} T${w} ${h * 0.68} L${w} ${h} L0 ${h} Z" fill="#c98a4b"/>` +
          `<path d="M0 ${h * 0.82} Q${w * 0.35} ${h * 0.74} ${w * 0.7} ${h * 0.82} T${w} ${h * 0.8} L${w} ${h} L0 ${h} Z" fill="#a96f38"/>` +
          `<path d="M0 ${h * 0.92} Q${w * 0.4} ${h * 0.86} ${w * 0.8} ${h * 0.92} T${w} ${h * 0.9} L${w} ${h} L0 ${h} Z" fill="#8a5a2c"/>` +
          `<path d="M${w * 0.62} ${h * 0.42} q10 -30 22 -34 q-4 26 -10 40 q-6 12 -20 12 q10 -6 8 -18 Z" fill="#7c5230"/>` +
          `<path d="M${w * 0.64} ${h * 0.44} q18 -14 34 -10 q-16 10 -30 14 q-8 4 -12 0 q6 -2 8 -4 Z" fill="#6b4426"/>`,
        glow: '',
      };
    }
    case 'space': {
      const sky = 'sky-sp';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<circle cx="${w * 0.3}" cy="${h * 0.28}" r="90" fill="#5c4a8a" opacity="0.25"/>` +
          `<circle cx="${w * 0.7}" cy="${h * 0.6}" r="70" fill="#2e5a7c" opacity="0.28"/>` +
          stars() +
          `<circle cx="${w * 0.22}" cy="${h * 0.2}" r="26" fill="#8fa3c8" opacity="0.85"/>` +
          `<circle cx="${w * 0.22}" cy="${h * 0.2}" r="30" fill="none" stroke="#8fa3c8" stroke-width="1.4" opacity="0.5"/>` +
          `<ellipse cx="${w * 0.22}" cy="${h * 0.2}" rx="52" ry="12" fill="none" stroke="#8fa3c8" stroke-width="1" opacity="0.3" transform="rotate(-18 ${w * 0.22} ${h * 0.2})"/>` +
          `<circle cx="${w * 0.78}" cy="${h * 0.62}" r="6" fill="#e0a35c" opacity="0.9"/>` +
          `<circle cx="${w * 0.78}" cy="${h * 0.62}" r="3" fill="#fff"/>` +
          `<rect x="${w * 0.66}" y="${h * 0.68}" width="46" height="18" rx="6" fill="#3a4658" transform="rotate(-14 ${w * 0.66} ${h * 0.68})"/>` +
          `<rect x="${w * 0.7}" y="${h * 0.64}" width="18" height="6" rx="3" fill="#526071" transform="rotate(-14 ${w * 0.7} ${h * 0.64})"/>`,
        glow: '',
      };
    }
    case 'street': {
      const sky = 'sky-st';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          city(h * 0.72, '#1a1f2c', true) +
          `<rect x="0" y="${h * 0.78}" width="${w}" height="${h * 0.22}" fill="#0e1119"/>` +
          `<ellipse cx="${w * 0.5}" cy="${h * 0.8}" rx="90" ry="8" fill="#ffd98a" opacity="0.22"/>` +
          `<rect x="${w * 0.47}" y="${h * 0.5}" width="6" height="${h * 0.3}" fill="#222836"/>` +
          `<circle cx="${w * 0.5}" cy="${h * 0.48}" r="8" fill="#ffd98a"/>` +
          `<circle cx="${w * 0.5}" cy="${h * 0.48}" r="20" fill="#ffd98a" opacity="0.25"/>` +
          `<path d="M0 ${h * 0.9} Q${w * 0.3} ${h * 0.82} ${w} ${h * 0.88}" fill="none" stroke="#2c3344" stroke-width="2"/>` +
          `<path d="M0 ${h * 0.96} Q${w * 0.4} ${h * 0.9} ${w} ${h * 0.94}" fill="none" stroke="#222836" stroke-width="2"/>` +
          `<circle cx="${w * 0.78}" cy="${h * 0.82}" r="9" fill="#0b0f16"/>` +
          `<path d="M${w * 0.74} ${h * 0.86} q2 -10 4 -12 q2 2 1 8 q1 6 -2 8 q-2 2 -3 -4 Z" fill="#0b0f16"/>` +
          `<path d="M${w * 0.8} ${h * 0.84} q-2 -8 -1 -10 q1 3 2 6 q0 5 -1 6 Z" fill="#0b0f16"/>`,
        glow: '',
      };
    }
    case 'campus': {
      const sky = 'sky-cp';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<circle cx="${w * 0.68}" cy="${h * 0.24}" r="26" fill="#fbe9c0" opacity="0.95"/>` +
          `<rect x="${w * 0.1}" y="${h * 0.46}" width="${w * 0.5}" height="${h * 0.34}" rx="6" fill="#d9c9a8"/>` +
          `<rect x="${w * 0.1}" y="${h * 0.42}" width="${w * 0.5}" height="${h * 0.06}" rx="3" fill="#bda77f"/>` +
          `<rect x="${w * 0.16}" y="${h * 0.56}" width="22" height="24" fill="#2e4a5e"/>` +
          `<rect x="${w * 0.3}" y="${h * 0.56}" width="22" height="24" fill="#2e4a5e"/>` +
          `<rect x="${w * 0.44}" y="${h * 0.56}" width="22" height="24" fill="#2e4a5e"/>` +
          trees(h * 0.8, '#3d5c3a', 5, 0.8) +
          `<rect x="0" y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="#4a5f42"/>` +
          `<circle cx="${w * 0.28}" cy="${h * 0.66}" r="8" fill="#0e1119"/>` +
          `<circle cx="${w * 0.3}" cy="${h * 0.66}" r="8" fill="#0e1119"/>` +
          `<rect x="${w * 0.24}" y="${h * 0.7}" width="40" height="5" rx="2" fill="#0e1119"/>`,
        glow: '',
      };
    }
    case 'tea-house': {
      const sky = 'sky-th';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          moon(w * 0.76, h * 0.16, 20) +
          `<path d="M${w * 0.12} ${h * 0.86} L${w * 0.12} ${h * 0.5} L${w * 0.32} ${h * 0.38} L${w * 0.52} ${h * 0.5} L${w * 0.52} ${h * 0.86} Z" fill="#3a2418"/>` +
          `<path d="M${w * 0.1} ${h * 0.42} L${w * 0.54} ${h * 0.42} L${w * 0.32} ${h * 0.3} Z" fill="#241309"/>` +
          `<rect x="${w * 0.22}" y="${h * 0.58}" width="14" height="20" fill="#ffb35c" opacity="0.85"/>` +
          `<rect x="${w * 0.38}" y="${h * 0.56}" width="12" height="16" fill="#ffb35c" opacity="0.7"/>` +
          `<circle cx="${w * 0.66}" cy="${h * 0.5}" r="26" fill="#ffd98a" opacity="0.16"/>` +
          `<path d="M${w * 0.62} ${h * 0.72} q0 -22 8 -26 q6 14 4 26 q-4 10 -12 6 Z" fill="#101623"/>` +
          `<path d="M${w * 0.6} ${h * 0.98} L${w * 0.6} ${h * 0.74} L${w * 0.74} ${h * 0.78} L${w * 0.74} ${h * 0.98} Z" fill="#2a1a10"/>` +
          `<ellipse cx="${w * 0.7}" cy="${h * 0.66}" rx="10" ry="4" fill="#c98a4b"/>` +
          `<ellipse cx="${w * 0.67}" cy="${h * 0.66}" rx="3" ry="6" fill="#5c3a20"/>` +
          trees(h * 0.88, '#1d2b1a', 4, 0.7),
        glow: '',
      };
    }
    case 'kitchen': {
      const sky = 'sky-kc';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<rect x="${w * 0.06}" y="${h * 0.16}" width="${w * 0.2}" height="${h * 0.3}" rx="4" fill="#0b1019"/>` +
          `<rect x="${w * 0.09}" y="${h * 0.2}" width="${w * 0.14}" height="${h * 0.22}" fill="#3f5566" opacity="0.9"/>` +
          `<path d="M${w * 0.16} ${h * 0.2} L${w * 0.12} ${h * 0.42} L${w * 0.2} ${h * 0.42} Z" fill="#2a3946"/>` +
          `<rect x="0" y="${h * 0.62}" width="${w}" height="12" fill="#241309"/>` +
          `<rect x="0" y="${h * 0.64}" width="${w}" height="${h * 0.36}" fill="#3a2418"/>` +
          `<ellipse cx="${w * 0.3}" cy="${h * 0.66}" rx="40" ry="10" fill="#222c38"/>` +
          `<ellipse cx="${w * 0.3}" cy="${h * 0.6}" rx="30" ry="16" fill="#4a5c6e"/>` +
          `<ellipse cx="${w * 0.3}" cy="${h * 0.56}" rx="18" ry="8" fill="#6b7f92"/>` +
          `<path d="M${w * 0.56} ${h * 0.7} q10 -34 22 -40 q8 26 2 42 q-6 12 -24 10 Z" fill="#8a4a2c"/>` +
          `<circle cx="${w * 0.68}" cy="${h * 0.42}" r="9" fill="#ffd98a" opacity="0.85"/>` +
          `<circle cx="${w * 0.68}" cy="${h * 0.42}" r="18" fill="#ffd98a" opacity="0.2"/>` +
          `<path d="M${w * 0.8} ${h * 0.55} q8 -26 20 -30 q6 22 -2 34 q-8 10 -18 4 Z" fill="#5c6b3a"/>` +
          `<ellipse cx="${w * 0.7}" cy="${h * 0.32}" rx="26" ry="8" fill="#fff" opacity="0.12"/>`,
        glow: '',
      };
    }
    case 'ghost': {
      const sky = 'sky-gh';
      return {
        sky,
        paint:
          `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` +
          `<circle cx="${w * 0.7}" cy="${h * 0.2}" r="18" fill="#f0e4c8" opacity="0.5"/>` +
          trees(h * 0.86, '#141b26', 4, 1.1) +
          `<path d="M${w * 0.18} ${h * 0.98} L${w * 0.18} ${h * 0.55} L${w * 0.22} ${h * 0.42} L${w * 0.26} ${h * 0.55} L${w * 0.26} ${h * 0.98} Z" fill="#0d131c"/>` +
          `<path d="M${w * 0.1} ${h * 0.6} q-30 -10 -40 -2 q10 -6 22 -4 q-8 12 2 16 q-4 -6 -8 -6 q12 -2 24 -4 Z" fill="#e8dfd0" opacity="0.12"/>` +
          fog('#cdd6de') +
          `<ellipse cx="${w * 0.5}" cy="${h * 0.9}" rx="70" ry="12" fill="#ffd98a" opacity="0.12"/>` +
          `<rect x="${w * 0.47}" y="${h * 0.72}" width="5" height="${h * 0.18}" fill="#1c2430"/>` +
          `<circle cx="${w * 0.5}" cy="${h * 0.7}" r="6" fill="#ffd98a" opacity="0.85"/>` +
          `<circle cx="${w * 0.5}" cy="${h * 0.7}" r="16" fill="#ffd98a" opacity="0.14"/>`,
        glow: '',
      };
    }
    default: {
      const sky = 'sky-mt';
      return {
        sky,
        paint: `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${sky})"/>` + mountains(h * 0.7, '#3a4a5e', 1),
        glow: '',
      };
    }
  }
}

export function sceneSky(scene: string): string {
  switch (scene) {
    case 'night-city':
      return '#251a48';
    case 'mountain':
      return '#3d2f62';
    case 'forest':
      return '#24483a';
    case 'snow':
      return '#d8e0f2';
    case 'sea':
      return '#263566';
    case 'desert':
      return '#f0a868';
    case 'space':
      return '#101a3c';
    case 'street':
      return '#323058';
    case 'campus':
      return '#f2b48a';
    case 'tea-house':
      return '#331e12';
    case 'kitchen':
      return '#26180a';
    case 'ghost':
      return '#28304a';
    default:
      return '#2c3252';
  }
}

const GRADS: Record<string, string> = {
  'sky-nc': 'linearGradient',
  'sky-mt': 'linearGradient',
  'sky-fr': 'linearGradient',
  'sky-sn': 'linearGradient',
  'sky-sea': 'linearGradient',
  'sky-ds': 'linearGradient',
  'sky-sp': 'radialGradient',
  'sky-st': 'linearGradient',
  'sky-cp': 'linearGradient',
  'sky-th': 'linearGradient',
  'sky-kc': 'linearGradient',
  'sky-gh': 'linearGradient',
};

/** 动漫暮色系天空：深夜蓝紫 → 霞光 → 樱粉/暖金地平线 */
export function gradBody(scene: string): string {
  switch (scene) {
    case 'night-city':
      return `<stop offset="0%" stop-color="#0c1030"/><stop offset="55%" stop-color="#2c1e55"/><stop offset="100%" stop-color="#8a4a72"/>`;
    case 'mountain':
      return `<stop offset="0%" stop-color="#1c2452"/><stop offset="55%" stop-color="#4a3670"/><stop offset="100%" stop-color="#c96f8a"/>`;
    case 'forest':
      return `<stop offset="0%" stop-color="#1a3830"/><stop offset="60%" stop-color="#26503a"/><stop offset="100%" stop-color="#3a6a48"/>`;
    case 'snow':
      return `<stop offset="0%" stop-color="#a8bcd8"/><stop offset="70%" stop-color="#d8e0f2"/><stop offset="100%" stop-color="#f2e8f0"/>`;
    case 'sea':
      return `<stop offset="0%" stop-color="#0a1434"/><stop offset="60%" stop-color="#263566"/><stop offset="100%" stop-color="#6a4a8e"/>`;
    case 'desert':
      return `<stop offset="0%" stop-color="#f9d9a0"/><stop offset="60%" stop-color="#f0a868"/><stop offset="100%" stop-color="#d96a88"/>`;
    case 'space':
      return `<stop offset="0%" stop-color="#05060f"/><stop offset="55%" stop-color="#101a3c"/><stop offset="100%" stop-color="#2c2260"/>`;
    case 'street':
      return `<stop offset="0%" stop-color="#1c2040"/><stop offset="70%" stop-color="#323058"/><stop offset="100%" stop-color="#644078"/>`;
    case 'campus':
      return `<stop offset="0%" stop-color="#f8d9a0"/><stop offset="70%" stop-color="#f2b48a"/><stop offset="100%" stop-color="#e89a9e"/>`;
    case 'tea-house':
      return `<stop offset="0%" stop-color="#20130a"/><stop offset="60%" stop-color="#331e12"/><stop offset="100%" stop-color="#48281a"/>`;
    case 'kitchen':
      return `<stop offset="0%" stop-color="#170e06"/><stop offset="60%" stop-color="#26180a"/><stop offset="100%" stop-color="#362210"/>`;
    case 'ghost':
      return `<stop offset="0%" stop-color="#1a2130"/><stop offset="60%" stop-color="#28304a"/><stop offset="100%" stop-color="#3c4868"/>`;
    default:
      return `<stop offset="0%" stop-color="#142042"/><stop offset="100%" stop-color="#4a3a6e"/>`;
  }
}

function defFor(scene: string, id: string): string {
  const kind = GRADS[scene] || 'linearGradient';
  const body = gradBody(scene);
  const inner = kind === 'radialGradient' ? `<radialGradient id="${id}" cx="50%" cy="40%" r="75%">${body}</radialGradient>` : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${body}</linearGradient>`;
  return `<defs>${inner}</defs>`;
}

/** 场景插画（横版） */
export function sceneSVG(scene: string, seed: string, opts: Opts = {}): string {
  const w = opts.w ?? 800;
  const h = opts.h ?? 600;
  const id = `g-${scene}-${seed.length}`;
  const art = paintScene(scene, seed, w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${defFor(scene, id)}<g>${art.paint}</g>${art.glow ? `<g>${art.glow}</g>` : ''}</svg>`;
}

/** 书籍封面（竖版 · 动漫海报式：天顶光晕 + 流云星光 + 底部渐隐标题区）。style: anime 日系漫感 / fresh 清新治愈 / dark 暗夜玄幻 / classic 经典网文；font: 书名字体栈（可选） */
export function coverSVG(seed: string, title: string, author: string, genre: string, opts: Opts & { style?: 'anime' | 'fresh' | 'dark' | 'classic'; font?: string } = {}): string {
  const w = opts.w ?? 400;
  const h = opts.h ?? 560;
  const style = opts.style ?? 'classic';
  const font = opts.font ?? FONT;
  const id = `cv-${seed.slice(0, 6)}-${style}`;
  const art = paintScene(seed, `${seed}-cover`, w, h);

  // 四套风格：标题/作者色 + 底部渐隐遮罩 + 题材章 + 氛围装饰色 + 动漫暮色叠加
  const PALETTES: Record<string, {
    title: string; author: string; border: string;
    scrimRgb: string; scrimA: number;
    chipFill: string; chipText: string;
    halo: string; cloud: string; starCols: string[];
    tint: [string, string]; tintA: number; darkText: boolean;
  }> = {
    anime: {
      title: '#ffffff', author: 'rgba(255,227,241,0.92)', border: 'rgba(255,214,236,0.7)',
      scrimRgb: '30,16,54', scrimA: 0.9,
      chipFill: 'rgba(255,170,215,0.28)', chipText: '#ffe3f1',
      halo: 'rgba(255,214,170,0.9)', cloud: 'rgba(255,240,250,0.6)',
      starCols: ['rgba(255,240,220,0.95)', 'rgba(255,196,225,0.9)', 'rgba(190,205,255,0.9)'],
      tint: ['#ff9ecf', '#8a5ab8'], tintA: 0.16, darkText: false,
    },
    fresh: {
      title: '#2a4438', author: 'rgba(42,68,56,0.85)', border: 'rgba(63,138,116,0.55)',
      scrimRgb: '250,240,224', scrimA: 0.92,
      chipFill: 'rgba(63,138,116,0.16)', chipText: '#2a5c4c',
      halo: 'rgba(255,244,214,0.95)', cloud: 'rgba(255,255,255,0.85)',
      starCols: ['rgba(255,255,255,0.9)'],
      tint: ['#ffe9b8', '#9ad8c0'], tintA: 0.14, darkText: true,
    },
    dark: {
      title: '#f6ecd6', author: 'rgba(246,236,214,0.8)', border: 'rgba(203,179,122,0.55)',
      scrimRgb: '5,7,14', scrimA: 0.94,
      chipFill: 'rgba(203,179,122,0.2)', chipText: '#e6d3a3',
      halo: 'rgba(170,150,255,0.6)', cloud: 'rgba(120,110,180,0.35)',
      starCols: ['rgba(255,236,190,0.9)', 'rgba(230,235,255,0.85)'],
      tint: ['#5a3a9f', '#c2497a'], tintA: 0.12, darkText: false,
    },
    classic: {
      title: '#f6ecd6', author: 'rgba(246,236,214,0.82)', border: 'rgba(217,180,126,0.6)',
      scrimRgb: '14,12,22', scrimA: 0.92,
      chipFill: 'rgba(217,180,126,0.22)', chipText: '#ecd6ac',
      halo: 'rgba(255,210,140,0.8)', cloud: 'rgba(255,235,205,0.4)',
      starCols: ['rgba(255,236,190,0.9)', 'rgba(230,235,255,0.85)'],
      tint: ['#e8a54a', '#8a4a6a'], tintA: 0.14, darkText: false,
    },
  };
  const P = PALETTES[style] ?? PALETTES.classic;

  // 氛围装饰（确定性随机，同 seed 同图）：天顶光晕 / 流云 / 星光与四芒闪星
  const r = makeRand(`${seed}:${style}:deco`);
  let deco = '';
  const hx = Math.round(w * (0.22 + r.next() * 0.56));
  const hy = Math.round(h * (0.13 + r.next() * 0.11));
  const hr = Math.round(w * 0.3);
  deco += `<circle cx="${hx}" cy="${hy}" r="${hr}" fill="${P.halo}" opacity="0.08"/>`
    + `<circle cx="${hx}" cy="${hy}" r="${Math.round(hr * 0.62)}" fill="${P.halo}" opacity="0.1"/>`
    + `<circle cx="${hx}" cy="${hy}" r="${Math.round(hr * 0.34)}" fill="${P.halo}" opacity="0.35"/>`;
  const nClouds = 2 + Math.round(r.next());
  for (let i = 0; i < nClouds; i++) {
    const cx = r.range(w * 0.12, w * 0.88);
    const cy = r.range(h * 0.08, h * 0.34);
    const s = r.range(0.7, 1.25);
    const cl = (dx: number, dy: number, rx: number, ry: number) =>
      `<ellipse cx="${(cx + dx * s).toFixed(1)}" cy="${(cy + dy * s).toFixed(1)}" rx="${(rx * s).toFixed(1)}" ry="${(ry * s).toFixed(1)}" fill="${P.cloud}"/>`;
    deco += cl(0, 0, 46, 15) + cl(-32, 6, 26, 10) + cl(34, 5, 30, 11) + cl(4, -10, 26, 12);
  }
  for (let i = 0; i < 15; i++) {
    const x = Math.round(r.next() * w);
    const y = Math.round(r.next() * h * 0.5);
    const col = P.starCols[Math.floor(r.next() * P.starCols.length)];
    if (r.next() < 0.3) {
      const s = r.range(4, 8);
      deco += `<path d="M${x} ${(y - s).toFixed(1)} Q${x} ${y.toFixed(1)} ${(x + s).toFixed(1)} ${y.toFixed(1)} Q${x} ${y.toFixed(1)} ${x} ${(y + s).toFixed(1)} Q${x} ${y.toFixed(1)} ${(x - s).toFixed(1)} ${y.toFixed(1)} Q${x} ${y.toFixed(1)} ${x} ${(y - s).toFixed(1)} Z" fill="${col}"/>`;
    } else {
      deco += `<circle cx="${x}" cy="${y}" r="${r.range(0.8, 2.2).toFixed(1)}" fill="${col}"/>`;
    }
  }

  // 海报式标题区：底部渐隐遮罩上叠标题（去旧版中央暗带）
  const lines = wrapCJK(title, 7);
  const titleSize = lines.length > 1 ? 34 : 40;
  const lineGap = Math.round(titleSize * 1.32);
  const lastY = Math.round(h * 0.845);
  const titleBlock = lines
    .map((ln, i) => {
      const y = lastY - (lines.length - 1 - i) * lineGap;
      const stroke = P.darkText ? '' : ` stroke="rgba(10,8,24,0.5)" stroke-width="6" paint-order="stroke" stroke-linejoin="round"`;
      return `<text x="${w / 2}" y="${y}" font-family="${font}" font-size="${titleSize}" font-weight="800" fill="${P.title}" text-anchor="middle"${stroke}>${esc(ln)}</text>`;
    })
    .join('');
  const scrimId = `${id}-scrim`;
  const tintId = `${id}-tint`;
  const scrimY = Math.round(h * 0.5);
  const chipW = Math.max(genre.length, 2) * 12 + 24;
  const chip = `<rect x="14" y="14" width="${chipW}" height="24" rx="12" fill="${P.chipFill}" stroke="${P.border}" stroke-width="0.8"/><text x="${14 + chipW / 2}" y="31" font-family="${FONT}" font-size="12" fill="${P.chipText}" text-anchor="middle" letter-spacing="2">${esc(genre)}</text>`;
  const size = Math.min(w, h) * 0.02;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${coverGradBody(seed, style)}</linearGradient><linearGradient id="${tintId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${P.tint[0]}"/><stop offset="100%" stop-color="${P.tint[1]}"/></linearGradient><linearGradient id="${scrimId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgb(${P.scrimRgb})" stop-opacity="0"/><stop offset="45%" stop-color="rgb(${P.scrimRgb})" stop-opacity="0.55"/><stop offset="100%" stop-color="rgb(${P.scrimRgb})" stop-opacity="${P.scrimA}"/></linearGradient></defs><rect x="0" y="0" width="${w}" height="${h}" fill="url(#${id})"/><g>${art.paint}</g>${art.glow ? `<g>${art.glow}</g>` : ''}${deco}<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${tintId})" opacity="${P.tintA}"/><rect x="0" y="${scrimY}" width="${w}" height="${h - scrimY}" fill="url(#${scrimId})"/>${chip}${titleBlock}<text x="${w / 2}" y="${lastY + Math.round(titleSize * 0.78)}" font-family="${FONT}" font-size="15" fill="${P.author}" text-anchor="middle" letter-spacing="3">${esc(author)}</text><rect x="${size * 3}" y="${size * 3}" width="${w - size * 6}" height="${h - size * 6}" fill="none" stroke="${P.border}" stroke-width="1.2" opacity="0.6"/></svg>`;
}

/** 按封面风格返回渐变 stop 色（动漫暮色系三段渐变，替换旧版白色洗段） */
export function coverGradBody(seed: string, style: string): string {
  const sets: Record<string, [string, string, string]> = {
    anime: ['#2b3a8f', '#8a5ab8', '#f08fb0'], // 暮蓝 → 紫罗兰 → 樱粉
    fresh: ['#a8dcc8', '#f4ecd2', '#f8cdb4'], // 薄荷 → 奶油 → 蜜桃
    dark: ['#0b1020', '#251d44', '#5a2440'], // 深夜 → 暗紫 → 绛红
    classic: ['#1d2740', '#4a3a52', '#96602c'], // 藏青 → 梅紫 → 暖金
  };
  const [a, b, c] = sets[style] ?? sets.classic;
  const r = makeRand(seed);
  const mid = Math.round(50 + r.next() * 12); // 50%–62%，同风格也各有层次
  return `<stop offset="0%" stop-color="${a}"/><stop offset="${mid}%" stop-color="${b}"/><stop offset="100%" stop-color="${c}"/>`;
}

/** 互动小说场景图（竖版 9:16 感） */
export function posterSVG(scene: string, seed: string, opts: Opts = {}): string {
  const w = opts.w ?? 600;
  const h = opts.h ?? 900;
  const id = `ps-${scene}-${seed.length}`;
  const art = paintScene(scene, seed, w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${defFor(scene, id)}<g>${art.paint}</g>${art.glow ? `<g>${art.glow}</g>` : ''}<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/></svg>`;
}

/* ---------------- 漫画页 ---------------- */

/** 漫画页（竖版分镜 + 对话框 + 旁白） */
export function comicPageSVG(scene: string, seed: string, dialogue: string[], caption: string | undefined, pageNo: number, opts: Opts = {}): string {
  const w = opts.w ?? 800;
  const h = opts.h ?? 1120;
  const id = `cm-${seed.slice(0, 8)}`;
  const panelN = Math.min(3, Math.max(2, Math.ceil(dialogue.length / 2) + (caption ? 0 : 1)));
  const pad = 26;
  const gap = 22;
  const ph = (h - pad * 2 - gap * (panelN - 1) - 70) / panelN;
  let panels = '';
  for (let i = 0; i < panelN; i++) {
    const y = pad + i * (ph + gap);
    const art = paintScene(scene, `${seed}-p${i}`, w - pad * 2, ph);
    const clip = `<clipPath id="clip-${id}-${i}"><rect x="${pad}" y="${y.toFixed(1)}" width="${w - pad * 2}" height="${ph.toFixed(1)}" rx="14"/></clipPath>`;
    panels += `<defs>${clip}</defs>`;
    panels += `<rect x="${pad}" y="${y.toFixed(1)}" width="${w - pad * 2}" height="${ph.toFixed(1)}" rx="14" fill="#101623"/>`;
    panels += `<g clip-path="url(#clip-${id}-${i})"><g transform="translate(${pad} ${y}) scale(${((w - pad * 2) / w).toFixed(4)} ${(ph / h).toFixed(4)})">${art.paint}</g>${art.glow ? `<g transform="translate(${pad} ${y})">${art.glow}</g>` : ''}</g>`;
    panels += `<rect x="${pad}" y="${y.toFixed(1)}" width="${w - pad * 2}" height="${ph.toFixed(1)}" rx="14" fill="none" stroke="rgba(255,255,255,0.08)"/>`;
  }
  // 对话框（说话者 + 气泡）
  let bubbles = '';
  const bubbleStartY = pad + panelN * (ph + gap) - gap;
  let by = bubbleStartY;
  dialogue.forEach((line, i) => {
    const colon = line.indexOf('：');
    const who = colon > 0 ? line.slice(0, colon) : '';
    const text = colon > 0 ? line.slice(colon + 1) : line;
    const fontSize = 21;
    const btw = Math.min(w - pad * 2 - 60, Math.max(120, text.length * fontSize + 60));
    const bh = 54;
    const isRight = i % 2 === 1;
    const actualX = isRight ? w - pad - 40 - btw : pad + 40;
    bubbles += `<ellipse cx="${actualX + btw / 2}" cy="${by + bh / 2}" rx="${btw / 2}" ry="${bh / 2}" fill="#f6ecd6" stroke="#cbb37a" stroke-width="1.5"/>`;
    bubbles += `<path d="M${actualX + btw / 2 - 10} ${by + bh} l-6 12 l14 -6 Z" fill="#f6ecd6"/>`;
    bubbles += `<text x="${actualX + btw / 2}" y="${by + bh / 2 + 7}" font-family="${FONT}" font-size="${fontSize}" fill="#22242c" text-anchor="middle">${esc(text)}</text>`;
    if (who) {
      bubbles += `<text x="${actualX + (isRight ? btw - 26 : 26)}" y="${by + bh + 26}" font-family="${FONT}" font-size="17" fill="#cbb37a" text-anchor="${isRight ? 'end' : 'start'}">${esc(who)}</text>`;
    }
    by += bh + 46;
  });
  const captionBox = caption
    ? `<rect x="${pad}" y="16" width="${w - pad * 2}" height="42" rx="21" fill="rgba(12,16,26,0.72)" stroke="rgba(255,255,255,0.1)"/><text x="${w / 2}" y="43" font-family="${FONT}" font-size="20" fill="#e8dcc0" text-anchor="middle">${esc(caption)}</text>`
    : '';
  const pageMark = `<text x="${w - 24}" y="${h - 14}" font-family="${FONT}" font-size="15" fill="#6b7688" text-anchor="end">P.${pageNo}</text>`;
  const bg = `<rect x="0" y="0" width="${w}" height="${h}" fill="#0a0e16"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${bg}${panels}${captionBox}${bubbles}${pageMark}</svg>`;
}

/** 用户头像（圆形渐变 + 首字） */
export function avatarSVG(seed: string, name: string): string {
  const r = makeRand(seed);
  const c1 = ['#c98a4b', '#3f5566', '#5c6b3a', '#8a4a2c', '#6b5a8a', '#2e5a7c'];
  const c2 = ['#e0b276', '#6b7f92', '#8fa67a', '#b06a44', '#9483b8', '#4d7fa0'];
  const a = r.pick(c1);
  const b = r.pick(c2);
  const ch = esc(name.slice(0, 1));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="100%" height="100%"><defs><linearGradient id="av-${seed.slice(0, 6)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs><rect x="0" y="0" width="96" height="96" rx="48" fill="url(#av-${seed.slice(0, 6)})"/><text x="48" y="60" font-family="${FONT}" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
}

/* ---------------- 画面人物（互动小说角色） ---------------- */

/** 程序化人物半身像：按 seed 确定性生成发型/发色/衣服/表情 */
export function personSVG(seed: string, name: string, opts: Opts & { dress?: string; hairStyle?: string } = {}): string {
  const { width = 200, height = 250 } = opts;
  const r = makeRand(seed);
  const skin = r.pick(['#ffe9d2', '#ffdcbc', '#f7cba6', '#efc095', '#e6b287']);
  const skinShadow = '#d9a06e';
  const hairColor = r.pick(['#2e2a33', '#4a3527', '#6b4a2f', '#7a2e3a', '#3a2e4a', '#2c4a55', '#8a6a4a']);
  const hairLight = r.pick(['#6b5a75', '#8a6a4a', '#a5825a', '#b5606a', '#6b5a8a', '#5a7a8a', '#c9a06a']);
  const eyeColor = r.pick(['#c96a4a', '#5a6a9a', '#8a4a7a', '#4a7a5a', '#7a5a9a', '#4a5a8a']);
  const cloth = r.pick(['#b5453a', '#3f5a7a', '#7a4a6a', '#4a7a6a', '#8a5a2c', '#5a3a7a', '#2e5a7c', '#a06a3a']);
  const cloth2 = r.pick(['#f0d6b0', '#c9d6e0', '#e0c9d6', '#c9e0d6', '#e0c9a0', '#d0c9e0', '#b0c9e0']);
  const hairStyle = opts.hairStyle ?? r.pick(['short', 'long', 'twin', 'bun', 'wave', 'hime', 'pony', 'spiky']);
  const happy = r.next() < 0.35;
  /* 服饰风格（角色 IP 多元化 · 参考画风）：gufeng 古风交领（狐妖小红娘）/ xiuxian 道袍（从前有座灵剑山）/ modern 现代衬衫（夏目友人帐）/ school 制服外套（灵契）/ yaoxian 妖仙披帛（涂山狐妖）；置于随机序列末位以保持旧 seed 角色完全不变 */
  const dress = opts.dress ?? r.pick(['gufeng', 'xiuxian', 'modern', 'school', 'yaoxian']);
  const hx = (x: number) => Math.round((x / 100) * width);
  const hy = (y: number) => Math.round((y / 125) * height);
  const hz = (z: number) => Math.round(z * (width / 100));

  /* ---- 日系动漫画法（狐妖小红娘风）：鹅蛋脸 + 大眼高光 + 腮红 + 精细发型 + 古风交领服饰 ---- */

  // 鹅蛋脸：额头宽、颧骨圆润、下颌收窄、下巴尖
  const face = `<path d="M50 26 Q38 26 33 34 Q27 44 27 54 Q27 66 33 74 Q40 82 50 84 Q60 82 67 74 Q73 66 73 54 Q73 44 67 34 Q62 26 50 26 Z" fill="${skin}"/>`;
  // 耳朵
  const earL = `<path d="M29 46 Q24 52 26 58 Q28 62 32 62 Q33 56 32 50 Z" fill="${skin}"/>`;
  const earR = `<path d="M71 46 Q76 52 74 58 Q72 62 68 62 Q67 56 68 50 Z" fill="${skin}"/>`;

  // 发型：分层刘海 + 侧发 + 高光挑染 + 呆毛/发饰（八种发型，角色 IP 多元化）
  let hair = '';
  if (hairStyle === 'short') {
    hair = `<path d="M50 20 Q24 20 20 40 Q18 50 24 48 L24 36 Q30 26 50 26 Q70 26 76 36 L76 48 Q82 50 80 40 Q76 20 50 20 Z" fill="${hairColor}"/>` +
      `<path d="M24 36 Q30 28 50 28 Q70 28 76 36 L76 44 Q70 34 50 34 Q30 34 24 44 Z" fill="${hairLight}" opacity="0.5"/>` +
      `<path d="M33 40 Q40 36 47 40 M53 40 Q60 36 67 40" stroke="${hairLight}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  } else if (hairStyle === 'long') {
    hair = `<path d="M50 18 Q22 20 18 42 L18 92 Q18 104 28 104 Q34 88 36 76 Q38 92 44 100 L44 42 Q44 28 50 26 Q56 28 56 42 L56 100 Q62 92 64 76 Q66 88 72 104 Q82 104 82 92 L82 42 Q78 20 50 18 Z" fill="${hairColor}"/>` +
      `<path d="M28 40 Q30 30 50 28 Q70 30 72 40 L72 48 Q70 36 50 36 Q30 36 28 48 Z" fill="${hairLight}" opacity="0.5"/>` +
      `<path d="M24 44 Q28 36 36 36 M64 36 Q72 36 76 44" stroke="${hairLight}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  } else if (hairStyle === 'twin') {
    hair = `<path d="M50 18 Q22 20 18 40 L18 46 Q24 48 28 42 L28 32 Q36 24 50 24 Q64 24 72 32 L72 42 Q76 48 82 46 L82 40 Q78 20 50 18 Z" fill="${hairColor}"/>` +
      `<circle cx="20" cy="50" r="13" fill="${hairColor}"/><circle cx="80" cy="50" r="13" fill="${hairColor}"/>` +
      `<path d="M20 42 Q18 50 20 58 Q24 60 26 54 Q27 46 26 42 Z" fill="${hairLight}" opacity="0.55"/>` +
      `<path d="M80 42 Q82 50 80 58 Q76 60 74 54 Q73 46 74 42 Z" fill="${hairLight}" opacity="0.55"/>` +
      `<circle cx="20" cy="36" r="4" fill="#f29aa8"/><circle cx="80" cy="36" r="4" fill="#f29aa8"/>` +
      `<path d="M32 36 Q38 30 48 30 M52 30 Q62 30 68 36" stroke="${hairLight}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  } else if (hairStyle === 'bun') {
    hair = `<path d="M50 18 Q22 20 18 40 L18 46 Q24 48 28 42 L28 32 Q36 24 50 24 Q64 24 72 32 L72 42 Q76 48 82 46 L82 40 Q78 20 50 18 Z" fill="${hairColor}"/>` +
      `<circle cx="50" cy="12" r="9" fill="${hairColor}"/><circle cx="50" cy="12" r="6" fill="${hairLight}" opacity="0.6"/>` +
      `<path d="M30 34 Q36 28 48 28 M52 28 Q64 28 70 34" stroke="${hairLight}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>` +
      `<path d="M45 12 L52 6 L55 12" fill="${cloth}"/>`;
  } else if (hairStyle === 'hime') {
    // 姬发式（狐妖/日漫公主头）：齐刘海 + 鬓角 + 呆毛，古风/道袍配发簪
    hair = `<path d="M50 16 Q20 18 16 40 L16 72 Q22 76 28 70 L28 46 Q34 32 50 30 Q66 32 72 46 L72 70 Q78 76 84 72 L84 40 Q80 18 50 16 Z" fill="${hairColor}"/>` +
      `<path d="M18 38 Q22 26 50 24 Q78 26 82 38 L82 44 Q78 32 50 32 Q22 32 18 44 Z" fill="${hairColor}"/>` +
      `<path d="M24 40 Q28 30 50 30 Q72 30 76 40 L76 46 Q72 38 50 38 Q28 38 24 46 Z" fill="${hairLight}" opacity="0.45"/>` +
      `<path d="M50 12 Q55 16 50 21" stroke="${hairColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M34 34 Q40 28 50 28 M58 28 Q64 32 68 38" stroke="${hairLight}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>` +
      (dress === 'gufeng' || dress === 'xiuxian' ? `<path d="M64 24 L74 15" stroke="#cbb37a" stroke-width="2.5" stroke-linecap="round"/>` : '');
  } else if (hairStyle === 'pony') {
    // 侧马尾（现代元气）：右马尾 + 蝴蝶结 + 呆毛
    hair = `<path d="M50 18 Q24 20 20 42 L20 48 Q26 50 30 44 L30 34 Q36 26 50 26 Q64 26 72 34 L74 52 Q78 52 80 48 L78 42 Q76 20 50 18 Z" fill="${hairColor}"/>` +
      `<path d="M74 40 Q80 50 76 62 Q84 58 84 68 L78 72 Q76 60 70 56 Q78 50 74 40 Z" fill="${hairColor}"/>` +
      `<path d="M78 54 Q82 62 79 68" stroke="${hairLight}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>` +
      `<circle cx="78" cy="47" r="4.5" fill="#f29aa8"/><circle cx="78" cy="47" r="1.8" fill="#fff" opacity="0.7"/>` +
      `<path d="M50 14 Q54 17 50 21" stroke="${hairColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M32 34 Q40 28 50 28 M60 28 Q66 32 68 38" stroke="${hairLight}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  } else if (hairStyle === 'spiky') {
    // 短发刺猬（少年感）：刺尖 + 前额碎发
    hair = `<path d="M50 18 Q28 18 24 34 L20 46 Q24 48 28 44 L30 34 Q38 24 50 24 Q62 24 70 34 L72 44 Q76 48 80 46 L76 34 Q72 18 50 18 Z" fill="${hairColor}"/>` +
      `<path d="M36 22 L33 12 L42 19 M50 20 L50 10 L58 19 M64 21 L67 11 L72 22" stroke="${hairColor}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="M34 34 Q40 28 50 28 Q60 28 66 34 L66 42 Q58 36 50 36 Q42 36 34 42 Z" fill="${hairLight}" opacity="0.45"/>` +
      `<path d="M30 36 Q36 30 44 30 M58 30 Q64 32 68 38" stroke="${hairLight}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  } else {
    // wave 波浪长发 + 呆毛
    hair = `<path d="M50 18 Q16 24 16 46 Q18 50 22 46 Q24 30 50 30 Q76 30 78 46 Q82 50 84 46 Q84 24 50 18 Z" fill="${hairColor}"/>` +
      `<path d="M28 34 Q24 42 26 50 Q30 44 34 46 Q36 38 34 34 Z" fill="${hairColor}" opacity="0.9"/>` +
      `<path d="M72 34 Q76 42 74 50 Q70 44 66 46 Q64 38 66 34 Z" fill="${hairColor}" opacity="0.9"/>` +
      `<path d="M50 28 Q56 36 54 44 Q62 40 66 50 Q58 48 56 56 Q52 48 50 54 Z" fill="${hairLight}" opacity="0.7"/>` +
      `<path d="M36 32 Q32 40 34 48" stroke="${hairLight}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>` +
      `<path d="M50 12 Q54 16 50 20" stroke="${hairColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }

  // 日系大眼：白底 + 虹膜 + 瞳孔 + 双层高光 + 上眼线 + 下眼线
  const eye = (cx: number) =>
    `<path d="M${cx - 8} 50 Q${cx} 44 ${cx + 8} 50 Q${cx} 56 ${cx - 8} 50 Z" fill="#fff"/>` +
    `<ellipse cx="${cx}" cy="50" rx="6" ry="5.4" fill="${eyeColor}"/>` +
    `<circle cx="${cx}" cy="50" r="3.1" fill="#26221f"/>` +
    `<circle cx="${cx - 2}" cy="48.2" r="1.5" fill="#fff" opacity="0.95"/>` +
    `<circle cx="${cx + 2.4}" cy="51.6" r="0.8" fill="#fff" opacity="0.7"/>` +
    `<path d="M${cx - 9} 48.5 Q${cx} 42 ${cx + 9} 48.5" stroke="#2a2320" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M${cx - 9.6} 49.5 Q${cx} 56.5 ${cx + 9.6} 49.5" stroke="#2a2320" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.55"/>`;
  const eyes = eye(hx(41)) + eye(hx(59));

  // 细弯眉
  const brow = `<path d="M${hx(35)} ${hy(42)} Q${hx(41)} ${hy(40)} ${hx(47)} ${hy(41.5)}" stroke="#5a4632" stroke-width="${hz(1.7)}" fill="none" stroke-linecap="round"/>` +
    `<path d="M${hx(53)} ${hy(41.5)} Q${hx(59)} ${hy(40)} ${hx(65)} ${hy(42)}" stroke="#5a4632" stroke-width="${hz(1.7)}" fill="none" stroke-linecap="round"/>`;

  // 腮红（日漫标配粉晕）
  const blush = `<ellipse cx="${hx(34)}" cy="${hy(57)}" rx="${hz(5)}" ry="${hz(3)}" fill="#f29aa8" opacity="0.4"/>` +
    `<ellipse cx="${hx(66)}" cy="${hy(57)}" rx="${hz(5)}" ry="${hz(3)}" fill="#f29aa8" opacity="0.4"/>`;

  const mouth = happy
    ? `<path d="M${hx(42)} ${hy(76)} Q${hx(50)} ${hy(82)} ${hx(58)} ${hy(76)}" stroke="#a54a3a" stroke-width="${hz(2.4)}" fill="none" stroke-linecap="round"/><path d="M${hx(47)} ${hy(77)} Q${hx(50)} ${hy(79.5)} ${hx(53)} ${hy(77)}" stroke="#e06a5a" stroke-width="${hz(1.4)}" fill="none"/>`
    : `<path d="M${hx(43)} ${hy(78)} Q${hx(50)} ${hy(75.5)} ${hx(57)} ${hy(78)}" stroke="#a54a3a" stroke-width="${hz(2.4)}" fill="none" stroke-linecap="round"/>`;

  // 服饰：五套画风（gufeng 古风交领·狐妖 / xiuxian 道袍·灵剑山 / modern 现代衬衫·夏目 / school 制服外套·灵契 / yaoxian 妖仙披帛·涂山狐妖）
  const id = `p-${seed.slice(0, 6)}`;
  const neck = `<path d="M${hx(44)} ${hy(84)} Q${hx(50)} ${hy(88)} ${hx(56)} ${hy(84)} L${hx(56)} ${hy(94)} Q${hx(50)} ${hy(97)} ${hx(44)} ${hy(94)} Z" fill="${skinShadow}"/>`;
  let clothBody = '';
  let collar = '';
  let belt = '';
  let accessory = '';
  if (dress === 'gufeng' || dress === 'yaoxian') {
    // 古风交领（狐妖小红娘基础款）
    clothBody = `<path d="M${hx(22)} ${hy(92)} Q${hx(50)} ${hy(86)} ${hx(78)} ${hy(92)} L${hx(86)} ${hy(124)} L${hx(14)} ${hy(124)} Z" fill="url(#${id})"/>`;
    collar = `<path d="M${hx(50)} ${hy(90)} L${hx(30)} ${hy(118)} L${hx(50)} ${hy(112)} Z" fill="${cloth2}" opacity="0.85"/>` +
      `<path d="M${hx(50)} ${hy(90)} L${hx(70)} ${hy(118)} L${hx(50)} ${hy(112)} Z" fill="${cloth2}" opacity="0.65"/>`;
    belt = `<path d="M${hx(26)} ${hy(112)} Q${hx(50)} ${hy(108)} ${hx(74)} ${hy(112)} L${hx(74)} ${hy(118)} Q${hx(50)} ${hy(114)} ${hx(26)} ${hy(118)} Z" fill="${cloth2}"/>`;
    if (dress === 'yaoxian') {
      // 妖仙披帛 + 铃铛（涂山狐妖仙气感）
      accessory = `<path d="M${hx(14)} ${hy(98)} Q${hx(26)} ${hy(90)} ${hx(36)} ${hy(96)} L${hx(32)} ${hy(124)} L${hx(12)} ${hy(122)} Z" fill="${cloth2}" opacity="0.85"/>` +
        `<path d="M${hx(86)} ${hy(98)} Q${hx(74)} ${hy(90)} ${hx(64)} ${hy(96)} L${hx(68)} ${hy(124)} L${hx(88)} ${hy(122)} Z" fill="${cloth2}" opacity="0.85"/>` +
        `<circle cx="${hx(30)}" cy="${hy(123)}" r="${hz(2.2)}" fill="#cbb37a"/>` +
        `<circle cx="${hx(70)}" cy="${hy(123)}" r="${hz(2.2)}" fill="#cbb37a"/>`;
    }
  } else if (dress === 'xiuxian') {
    // 道袍：大袖 + 斜襟 + 腰带 + 飘带（从前有座灵剑山）
    clothBody = `<path d="M${hx(16)} ${hy(92)} Q${hx(50)} ${hy(84)} ${hx(84)} ${hy(92)} L${hx(92)} ${hy(124)} L${hx(8)} ${hy(124)} Z" fill="url(#${id})"/>` +
      `<path d="M${hx(10)} ${hy(96)} L${hx(16)} ${hy(124)}" stroke="${cloth2}" stroke-width="2" opacity="0.4"/>` +
      `<path d="M${hx(90)} ${hy(96)} L${hx(84)} ${hy(124)}" stroke="${cloth2}" stroke-width="2" opacity="0.4"/>`;
    collar = `<path d="M${hx(50)} ${hy(88)} L${hx(28)} ${hy(120)} L${hx(50)} ${hy(112)} Z" fill="${cloth2}" opacity="0.9"/>`;
    belt = `<path d="M${hx(24)} ${hy(110)} Q${hx(50)} ${hy(106)} ${hx(76)} ${hy(110)} L${hx(76)} ${hy(116)} Q${hx(50)} ${hy(112)} ${hx(24)} ${hy(116)} Z" fill="${cloth2}"/>`;
    accessory = `<path d="M${hx(64)} ${hy(112)} Q${hx(78)} ${hy(122)} ${hx(72)} ${hy(124)} Q${hx(62)} ${hy(116)} ${hx(54)} ${hy(114)} Z" fill="${cloth}" opacity="0.85"/>`;
  } else if (dress === 'modern') {
    // 现代衬衫：圆领 + 门襟 + 扣子（夏目友人帐治愈感）
    clothBody = `<path d="M${hx(22)} ${hy(92)} Q${hx(50)} ${hy(86)} ${hx(78)} ${hy(92)} L${hx(86)} ${hy(124)} L${hx(14)} ${hy(124)} Z" fill="url(#${id})"/>`;
    collar = `<path d="M${hx(50)} ${hy(87)} Q${hx(43)} ${hy(94)} ${hx(43)} ${hy(101)} L${hx(57)} ${hy(101)} Q${hx(57)} ${hy(94)} ${hx(50)} ${hy(87)} Z" fill="${cloth2}"/>` +
      `<path d="M${hx(50)} ${hy(101)} L${hx(50)} ${hy(113)}" stroke="${cloth2}" stroke-width="1.8"/>` +
      `<circle cx="${hx(50)}" cy="${hy(105)}" r="${hz(1.6)}" fill="${cloth2}"/><circle cx="${hx(50)}" cy="${hy(110)}" r="${hz(1.6)}" fill="${cloth2}"/>`;
    belt = '';
  } else {
    // school 制服外套：西装领 + 领带（灵契现代都市感）
    clothBody = `<path d="M${hx(22)} ${hy(92)} Q${hx(50)} ${hy(86)} ${hx(78)} ${hy(92)} L${hx(86)} ${hy(124)} L${hx(14)} ${hy(124)} Z" fill="url(#${id})"/>`;
    collar = `<path d="M${hx(50)} ${hy(89)} L${hx(36)} ${hy(103)} L${hx(50)} ${hy(99)} L${hx(64)} ${hy(103)} Z" fill="${cloth2}" opacity="0.9"/>` +
      `<path d="M${hx(46)} ${hy(100)} L${hx(54)} ${hy(100)} L${hx(50)} ${hy(112)} Z" fill="#c96a4a"/>`;
    belt = `<path d="M${hx(26)} ${hy(112)} Q${hx(50)} ${hy(108)} ${hx(74)} ${hy(112)} L${hx(74)} ${hy(118)} Q${hx(50)} ${hy(114)} ${hx(26)} ${hy(118)} Z" fill="${cloth2}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${cloth}"/><stop offset="100%" stop-color="${cloth2}"/></linearGradient></defs>
${clothBody}
${collar}
${belt}
${accessory}
${neck}
${earL}${earR}
${face}
${hair}
${eyes}
${brow}
${blush}
${mouth}
<text x="${hx(50)}" y="${hy(18)}" font-family="${FONT}" font-size="${hz(11)}" font-weight="700" fill="#cbb37a" text-anchor="middle">${esc(name)}</text>
</svg>`;
}
