import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { personSVG } from '@/lib/svg';

describe('gen person svg samples', () => {
  it('writes 5 style samples', () => {
    const seeds = ['lingxi', 'suxin', 'aqing', 'momo', 'xiaoyu'];
    const names = ['灵溪', '苏心', '阿青', '墨墨', '小雨'];
    seeds.forEach((s, i) => {
      const svg = personSVG(s, names[i]);
      writeFileSync(`F:/创作数据/TraeCode-CN前端优化/验证截图/round2/person-${i}.svg`, svg, 'utf8');
    });
    expect(true).toBe(true);
  });
});