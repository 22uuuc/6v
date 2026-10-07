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

/** 简易文本：返回 <text> 元素（font 内双引号自动转义，避免破坏属性） */
function txt(x: number, y: number, s: string, size: number, fill: string, anchor = 'middle', weight = 400, opacity = 1, font = FONT): string {
  const lines = s.split('\n');
  const tspans = lines
    .map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * 1.3}">${ln}</tspan>`)
    .join('');
  const fontAttr = String(font).replace(/"/g, '&quot;');
  return `<text x="${x}" y="${y}" font-family="${fontAttr}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${tspans}</text>`;
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

function sceneSky(scene: string): string {
  switch (scene) {
    case 'night-city':
      return '#0a0e18';
    case 'mountain':
      return '#1c2735';
    case 'forest':
      return '#16281e';
    case 'snow':
      return '#dce6ee';
    case 'sea':
      return '#0e1c30';
    case 'desert':
      return '#f2c98c';
    case 'space':
      return '#05070f';
    case 'street':
      return '#222636';
    case 'campus':
      return '#f0d9ac';
    case 'tea-house':
      return '#231610';
    case 'kitchen':
      return '#191007';
    case 'ghost':
      return '#232a33';
    default:
      return '#1c2735';
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

function gradBody(scene: string): string {
  switch (scene) {
    case 'night-city':
      return `<stop offset="0%" stop-color="#0c1322"/><stop offset="60%" stop-color="#131a2c"/><stop offset="100%" stop-color="#1d2438"/>`;
    case 'mountain':
      return `<stop offset="0%" stop-color="#14202e"/><stop offset="55%" stop-color="#243244"/><stop offset="100%" stop-color="#3a4a5e"/>`;
    case 'forest':
      return `<stop offset="0%" stop-color="#1a2c20"/><stop offset="60%" stop-color="#24382a"/><stop offset="100%" stop-color="#2f4532"/>`;
    case 'snow':
      return `<stop offset="0%" stop-color="#aebdcc"/><stop offset="70%" stop-color="#d4dee8"/><stop offset="100%" stop-color="#eef3f6"/>`;
    case 'sea':
      return `<stop offset="0%" stop-color="#0a1526"/><stop offset="60%" stop-color="#12243c"/><stop offset="100%" stop-color="#1b3350"/>`;
    case 'desert':
      return `<stop offset="0%" stop-color="#f7d9a8"/><stop offset="60%" stop-color="#efbd7c"/><stop offset="100%" stop-color="#d99852"/>`;
    case 'space':
      return `<stop offset="0%" stop-color="#05070f"/><stop offset="55%" stop-color="#0c1220"/><stop offset="100%" stop-color="#16203a"/>`;
    case 'street':
      return `<stop offset="0%" stop-color="#1a1f2e"/><stop offset="70%" stop-color="#262c40"/><stop offset="100%" stop-color="#333a52"/>`;
    case 'campus':
      return `<stop offset="0%" stop-color="#f6e3b8"/><stop offset="70%" stop-color="#eccb92"/><stop offset="100%" stop-color="#dfb276"/>`;
    case 'tea-house':
      return `<stop offset="0%" stop-color="#1c1109"/><stop offset="60%" stop-color="#2c1a10"/><stop offset="100%" stop-color="#3d2416"/>`;
    case 'kitchen':
      return `<stop offset="0%" stop-color="#150d05"/><stop offset="60%" stop-color="#241708"/><stop offset="100%" stop-color="#33200d"/>`;
    case 'ghost':
      return `<stop offset="0%" stop-color="#191f28"/><stop offset="60%" stop-color="#232b36"/><stop offset="100%" stop-color="#2e3744"/>`;
    default:
      return `<stop offset="0%" stop-color="#14202e"/><stop offset="100%" stop-color="#3a4a5e"/>`;
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

/** 书籍封面（竖版，带书名）。style: anime 日系漫感 / fresh 清新治愈 / dark 暗夜玄幻 / classic 经典网文；font: 书名字体栈（可选） */
export function coverSVG(seed: string, title: string, author: string, genre: string, opts: Opts & { style?: 'anime' | 'fresh' | 'dark' | 'classic'; font?: string } = {}): string {
  const w = opts.w ?? 400;
  const h = opts.h ?? 560;
  const style = opts.style ?? 'classic';
  const font = opts.font ?? FONT;
  const id = `cv-${seed.slice(0, 6)}-${style}`;
  const art = paintScene(seed, `${seed}-cover`, w, h);

  // 四套风格：底渐变 / 遮罩 / 标题色 / 次色 / 边框色
  const PALETTES: Record<string, { grad: [string, string, string]; mask: string; title: string; accent: string; border: string; darkText: boolean }> = {
    anime: { grad: ['#3b4a8f', '#7d5aa6', '#c96f9f'], mask: 'rgba(10,14,26,0.26)', title: '#fff7e6', accent: '#e8a0c8', border: '#f0c6dd', darkText: false },
    fresh: { grad: ['#cfe8e2', '#f0ecd0', '#f6d9c2'], mask: 'rgba(30,50,60,0.10)', title: '#24403a', accent: '#3f8a74', border: '#9ac4b2', darkText: true },
    dark: { grad: ['#101625', '#1c2440', '#4a2c3a'], mask: 'rgba(5,8,14,0.5)', title: '#f6ecd6', accent: '#cbb37a', border: '#cbb37a', darkText: false },
    classic: { grad: ['#26324a', '#3a3f52', '#8a5a2c'], mask: 'rgba(10,14,24,0.42)', title: '#f6ecd6', accent: '#cbb37a', border: '#cbb37a', darkText: false },
  };
  const P = PALETTES[style] ?? PALETTES.classic;

  const lines = wrapCJK(title, 7);
  const titleBlock = lines
    .map((ln, i) => txt(w / 2, h * 0.5 + i * 46, ln, lines.length > 1 ? 34 : 40, P.title, 'middle', 700, 1, font))
    .join('');
  const size = Math.min(w, h) * 0.02;

  // 装饰：anime 星光点点 / fresh 水彩气泡；dark / classic 不加
  let deco = '';
  if (style === 'anime' || style === 'fresh') {
    const r = makeRand(`${seed}:${style}`);
    const count = style === 'anime' ? 14 : 12;
    for (let i = 0; i < count; i++) {
      const x = Math.round(r.next() * w);
      const y = Math.round(20 + r.next() * h * 0.55);
      const d = Math.round(2 + r.next() * 3.5);
      const col = style === 'anime' ? (r.next() < 0.5 ? 'rgba(255,240,220,0.85)' : 'rgba(240,190,215,0.8)') : 'rgba(255,255,255,0.7)';
      deco += `<circle cx="${x}" cy="${y}" r="${d}" fill="${col}"/>`;
    }
  }

  const genreFill = style === 'fresh' ? '#5d7a70' : style === 'anime' ? '#e8cfe0' : '#8f9aa8';
  const authorFill = style === 'fresh' ? '#24403a' : style === 'anime' ? '#fff7e6' : P.accent;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${coverGradBody(seed, style)}</linearGradient></defs><rect x="0" y="0" width="${w}" height="${h}" fill="url(#${id})"/><g>${art.paint}</g>${art.glow ? `<g>${art.glow}</g>` : ''}<rect x="0" y="0" width="${w}" height="${h}" fill="${P.mask}"/>${deco}<rect x="0" y="${h * 0.42}" width="${w}" height="${h * 0.3}" fill="rgba(10,14,24,0.55)"/>${titleBlock}<text x="${w / 2}" y="${h * 0.7}" font-family="${FONT}" font-size="18" fill="${authorFill}" text-anchor="middle">${author}</text><text x="${w / 2}" y="${h * 0.755}" font-family="${FONT}" font-size="13" fill="${genreFill}" text-anchor="middle">${genre}</text><rect x="${size * 3}" y="${size * 3}" width="${w - size * 6}" height="${h - size * 6}" fill="none" stroke="${P.border}" stroke-width="1.2" opacity="0.6"/></svg>`;
}

/** 按封面风格返回渐变 stop 色 */
function coverGradBody(seed: string, style: string): string {
  const sets: Record<string, [string, string]> = {
    anime: ['#4a5aa8', '#c96f9f'],
    fresh: ['#cfe8e2', '#f6d9c2'],
    dark: ['#16203a', '#4a2c3a'],
    classic: ['#26324a', '#8a5a2c'],
  };
  const [a, b] = sets[style] ?? sets.classic;
  const r = makeRand(seed);
  const c1 = r.pick(['#ffffff', '#ffffff', '#ffe9d2']);
  return `<stop offset="0%" stop-color="${a}"/><stop offset="55%" stop-color="${c1}"/><stop offset="100%" stop-color="${b}"/>`;
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
    bubbles += `<text x="${actualX + btw / 2}" y="${by + bh / 2 + 7}" font-family="${FONT}" font-size="${fontSize}" fill="#22242c" text-anchor="middle">${text}</text>`;
    if (who) {
      bubbles += `<text x="${actualX + (isRight ? btw - 26 : 26)}" y="${by + bh + 26}" font-family="${FONT}" font-size="17" fill="#cbb37a" text-anchor="${isRight ? 'end' : 'start'}">${who}</text>`;
    }
    by += bh + 46;
  });
  const captionBox = caption
    ? `<rect x="${pad}" y="16" width="${w - pad * 2}" height="42" rx="21" fill="rgba(12,16,26,0.72)" stroke="rgba(255,255,255,0.1)"/><text x="${w / 2}" y="43" font-family="${FONT}" font-size="20" fill="#e8dcc0" text-anchor="middle">${caption}</text>`
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
  const ch = name.slice(0, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="100%" height="100%"><defs><linearGradient id="av-${seed.slice(0, 6)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs><rect x="0" y="0" width="96" height="96" rx="48" fill="url(#av-${seed.slice(0, 6)})"/><text x="48" y="60" font-family="${FONT}" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
}

/* ---------------- 画面人物（互动小说角色） ---------------- */

/** 程序化人物半身像：按 seed 确定性生成发型/发色/衣服/表情 */
export function personSVG(seed: string, name: string, opts: Opts = {}): string {
  const { width = 200, height = 250 } = opts;
  const r = makeRand(seed);
  const skin = r.pick(['#f2c9a0', '#eab98a', '#d9a06e', '#c98a5b', '#b57a4e']);
  const hairColor = r.pick(['#3a2e26', '#5b4632', '#7a5a3a', '#2e2a33', '#8a6a4a', '#4a3a55']);
  const cloth = r.pick(['#7a4a2c', '#3f5566', '#8a5a3a', '#5c6b3a', '#6b3a5a', '#2e5a7c', '#a05a2c']);
  const cloth2 = r.pick(['#e0b276', '#6b7f92', '#c98a5b', '#8fa67a', '#9483b8', '#4d7fa0']);
  const hairStyle = r.pick(['short', 'long', 'twin', 'bun', 'wave']);
  const happy = r.next() < 0.35;
  const hx = (x: number) => Math.round((x / 100) * width);
  const hy = (y: number) => Math.round((y / 125) * height);
  const hz = (z: number) => Math.round(z * (width / 100));

  let hair = '';
  if (hairStyle === 'short') {
    hair = `<path d="M50 22 Q20 22 18 44 Q16 52 22 50 L22 34 Q30 24 50 24 Q70 24 78 34 L78 50 Q84 52 82 44 Q80 22 50 22 Z" fill="${hairColor}"/>`;
  } else if (hairStyle === 'long') {
    hair = `<path d="M50 20 Q18 24 16 46 L16 96 Q16 104 24 102 Q30 86 34 78 Q36 96 42 100 L44 44 Q44 30 50 28 Q56 30 56 44 L58 100 Q64 96 66 78 Q70 86 76 102 Q84 104 84 96 L84 46 Q82 24 50 20 Z" fill="${hairColor}"/>`;
  } else if (hairStyle === 'twin') {
    hair = `<path d="M50 20 Q20 24 18 44 L18 52 Q24 54 28 48 L28 38 Q36 26 50 26 Q64 26 72 38 L72 48 Q76 54 82 52 L82 44 Q80 24 50 20 Z" fill="${hairColor}"/><circle cx="20" cy="52" r="11" fill="${hairColor}"/><circle cx="80" cy="52" r="11" fill="${hairColor}"/>`;
  } else if (hairStyle === 'bun') {
    hair = `<path d="M50 22 Q20 26 18 44 L18 50 Q24 52 28 46 L28 36 Q36 26 50 26 Q64 26 72 36 L72 46 Q76 52 82 50 L82 44 Q80 26 50 22 Z" fill="${hairColor}"/><circle cx="50" cy="14" r="10" fill="${hairColor}"/>`;
  } else {
    hair = `<path d="M50 20 Q16 26 16 48 Q18 50 22 48 Q24 28 50 28 Q76 28 78 48 Q82 50 84 48 Q84 26 50 20 Z" fill="${hairColor}"/><path d="M50 28 Q56 36 54 44 Q62 40 66 50 Q58 48 56 56 Q52 48 50 54 Z" fill="${hairColor}" opacity="0.9"/>`;
  }

  const mouth = happy ? '<path d="M42 84 Q50 92 58 84" stroke="#a54a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : '<path d="M42 86 Q50 82 58 86" stroke="#a54a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  const id = `p-${seed.slice(0, 6)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${cloth}"/><stop offset="100%" stop-color="${cloth2}"/></linearGradient></defs>
<rect x="${hx(22)}" y="${hy(92)}" width="${hx(56)}" height="${hy(33)}" rx="${hz(10)}" fill="url(#${id})"/>
<circle cx="${hx(50)}" cy="${hy(52)}" r="${hz(30)}" fill="${skin}"/>
<ellipse cx="${hx(50)}" cy="${hy(74)}" rx="${hz(26)}" ry="${hz(14)}" fill="${skin}"/>
${hair}
<circle cx="${hx(41)}" cy="${hy(48)}" r="${hz(2.6)}" fill="#26221f"/><circle cx="${hx(59)}" cy="${hy(48)}" r="${hz(2.6)}" fill="#26221f"/>
<path d="M${hx(38)} ${hy(56)} Q${hx(50)} ${hy(60)} ${hx(62)} ${hy(56)}" stroke="#d9a06e" stroke-width="${hz(1.6)}" fill="none" stroke-linecap="round"/>
${mouth}
<text x="${hx(50)}" y="${hy(18)}" font-family="${FONT}" font-size="${hz(11)}" font-weight="700" fill="#cbb37a" text-anchor="middle">${name}</text>
</svg>`;
}
