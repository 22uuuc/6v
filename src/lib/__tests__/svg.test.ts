// 动漫风格优化单元测试：覆盖封面 SVG、四风格渐变、12 场景暮色天空等纯函数。
// 这些用例直接锁定「去中央暗带 / 去白色洗段 / 海报式标题 / 动漫暮色天空」等改造点，防止回归。
import { describe, it, expect } from 'vitest';
import {
  coverSVG,
  coverGradBody,
  sceneSky,
  gradBody,
} from '@/lib/svg';

const SCENES = [
  'night-city', 'mountain', 'forest', 'snow', 'sea', 'desert',
  'space', 'street', 'campus', 'tea-house', 'kitchen', 'ghost',
] as const;

describe('sceneSky — 12 场景月亮缺口色', () => {
  it.each(SCENES)('%s 返回有效的十六进制色', (scene) => {
    const c = sceneSky(scene);
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('未知场景回退默认色 #2c3252', () => {
    expect(sceneSky('unknown-xyz')).toBe('#2c3252');
  });

  it('night-city 为暮紫调而非旧版纯黑', () => {
    expect(sceneSky('night-city')).toBe('#251a48');
  });
});

describe('gradBody — 12 场景动漫暮色天空渐变', () => {
  it.each(SCENES)('%s 含三段 stop-color', (scene) => {
    const stops = gradBody(scene);
    const count = (stops.match(/stop-color=/g) || []).length;
    expect(count).toBe(3);
  });

  it.each(SCENES)('%s 不含白色洗段（旧版 #fff/#ffffff 回归保护）', (scene) => {
    const stops = gradBody(scene).toLowerCase();
    expect(stops).not.toContain('stop-color="#fff"');
    expect(stops).not.toContain('stop-color="#ffffff"');
  });

  it('night-city 为暮蓝→紫→樱粉色调', () => {
    expect(gradBody('night-city')).toContain('#0c1030');
    expect(gradBody('night-city')).toContain('#2c1e55');
    expect(gradBody('night-city')).toContain('#8a4a72');
  });

  it('mountain 含霞光中段 #4a3670', () => {
    expect(gradBody('mountain')).toContain('#4a3670');
  });

  it('campus 为暖金暮色调', () => {
    expect(gradBody('campus')).toContain('#f8d9a0');
    expect(gradBody('campus')).toContain('#e89a9e');
  });

  it('未知场景回退默认渐变', () => {
    expect(gradBody('nope')).toContain('#142042');
    expect(gradBody('nope')).toContain('#4a3a6e');
  });
});

describe('coverGradBody — 四风格三段渐变（去白色洗段）', () => {
  const STYLES = ['anime', 'fresh', 'dark', 'classic'] as const;

  it.each(STYLES)('%s 返回三段 stop', (style) => {
    const stops = coverGradBody('seed-x', style);
    expect((stops.match(/stop-color=/g) || []).length).toBe(3);
  });

  it.each(STYLES)('%s 不含 100%% 白色 stop（旧版洗白回归保护）', (style) => {
    const stops = coverGradBody('seed-x', style).toLowerCase();
    expect(stops).not.toContain('stop-color="#fff"');
    expect(stops).not.toContain('stop-color="#ffffff"');
  });

  it('anime 为暮蓝→紫罗兰→樱粉', () => {
    const stops = coverGradBody('s1', 'anime');
    expect(stops).toContain('#2b3a8f');
    expect(stops).toContain('#8a5ab8');
    expect(stops).toContain('#f08fb0');
  });

  it('fresh 为薄荷→奶油→蜜桃（清新治愈）', () => {
    const stops = coverGradBody('s2', 'fresh');
    expect(stops).toContain('#a8dcc8');
    expect(stops).toContain('#f4ecd2');
    expect(stops).toContain('#f8cdb4');
  });

  it('dark 为深夜→暗紫→绛红', () => {
    const stops = coverGradBody('s3', 'dark');
    expect(stops).toContain('#0b1020');
    expect(stops).toContain('#251d44');
    expect(stops).toContain('#5a2440');
  });

  it('classic 为藏青→梅紫→暖金', () => {
    const stops = coverGradBody('s4', 'classic');
    expect(stops).toContain('#1d2740');
    expect(stops).toContain('#4a3a52');
    expect(stops).toContain('#96602c');
  });

  it('未知风格回退 classic 色组', () => {
    const stops = coverGradBody('s5', 'nope');
    expect(stops).toContain('#96602c');
  });

  it('中段 offset 落在 50–62 区间', () => {
    const stops = coverGradBody('deterministic-seed', 'anime');
    // match() 只匹配第一个 offset（"0%"），用 matchAll 取第二个 stop 的 offset
    const matches = [...stops.matchAll(/offset="(\d+)%"/g)];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const mid = Number(matches[1][1]);
    expect(mid).toBeGreaterThanOrEqual(50);
    expect(mid).toBeLessThanOrEqual(62);
  });

  it('确定性：同 seed 同 style 产出完全一致', () => {
    expect(coverGradBody('abc', 'anime')).toBe(coverGradBody('abc', 'anime'));
  });
});

describe('coverSVG — 动漫海报式封面', () => {
  it('确定性：同输入产出相同 SVG', () => {
    const a = coverSVG('seed-1', '剑来', '烽火戏诸侯', '玄幻', { style: 'anime' });
    const b = coverSVG('seed-1', '剑来', '烽火戏诸侯', '玄幻', { style: 'anime' });
    expect(a).toBe(b);
  });

  it('输出为合法 SVG 根元素', () => {
    const svg = coverSVG('s', '书名', '作者', '都市', { style: 'fresh' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('不含旧版中央暗带（rgba(10,14,24,0.55) 横贯封面）', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻', { style: 'anime' });
    expect(svg).not.toContain('rgba(10,14,24,0.55)');
    expect(svg).not.toContain('fill="rgba(10,14,24,0.55)"');
  });

  it('含底部渐隐遮罩（scrim 渐变，opacity 0→scrimA）', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻', { style: 'anime' });
    expect(svg).toMatch(/-scrim"/);
    expect(svg).toContain('stop-opacity="0"');
    expect(svg).toContain('stop-opacity="0.55"');
    expect(svg).toContain('stop-opacity="0.9"');
  });

  it('含题材章（chip rect + genre 文本）', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻', { style: 'anime' });
    expect(svg).toContain('rx="12"');
    expect(svg).toContain('>玄幻</');
  });

  it('含天顶光晕（3 个同心 circle）', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻', { style: 'anime' });
    // anime 调色板 halo 色
    expect(svg).toContain('rgba(255,214,170,0.9)');
    // 三层光晕 opacity
    expect(svg).toContain('opacity="0.08"');
    expect(svg).toContain('opacity="0.1"');
    expect(svg).toContain('opacity="0.35"');
  });

  it('含星光装饰（circle 或四芒 path）', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻', { style: 'anime' });
    // 星光使用 anime 调色板的 starCols
    expect(svg).toContain('rgba(255,240,220,0.95)');
  });

  it('含动漫暮色叠加层（tint 渐变）', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻', { style: 'anime' });
    expect(svg).toMatch(/-tint"/);
    expect(svg).toContain('#ff9ecf');
    expect(svg).toContain('#8a5ab8');
  });

  it('anime/dark/classic 标题带描边发光（paint-order="stroke"）', () => {
    for (const style of ['anime', 'dark', 'classic'] as const) {
      const svg = coverSVG('s', '书名长标题', '作者', '玄幻', { style });
      expect(svg).toContain('paint-order="stroke"');
    }
  });

  it('fresh 标题不描边（深色文字直接可读）', () => {
    const svg = coverSVG('s', '书名', '作者', '都市', { style: 'fresh' });
    expect(svg).not.toContain('paint-order="stroke"');
  });

  it('标题与作者文本被转义（防 SVG 注入）', () => {
    // 用 ≤7 字符的标题，避免 wrapCJK 折行打断转义序列
    const svg = coverSVG('s', '<img>', '作者&<>"', '玄幻', { style: 'anime' });
    expect(svg).not.toContain('<img>');
    expect(svg).toContain('&lt;img&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&quot;');
  });

  it('默认风格为 classic', () => {
    const svg = coverSVG('s', '书', '作者', '玄幻');
    // classic 调色板的 tint 色 #e8a54a
    expect(svg).toContain('#e8a54a');
  });

  it('长标题自动折行（wrapCJK）', () => {
    const long = '这是一个非常长的书名需要折行处理测试';
    const svg = coverSVG('s', long, '作者', '玄幻', { style: 'anime' });
    // 折行后应出现多个 <text> 标题元素
    const titleTexts = (svg.match(/font-weight="800"/g) || []).length;
    expect(titleTexts).toBeGreaterThan(1);
  });
});
