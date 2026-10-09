import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// ── 关键 hack：禁用 fs.realpathSync 的 junction 解析 ──────────────────────
// 本项目 C: 路径的 realpath 会解析到 F: 副本（含空格 "TRAE SOLO CN"），
// 而 vitest 自带的 vite 7.3.7 在 Windows 下处理含空格的 file URL 时，
// %20 解码异常导致 loadAndTransform 找不到文件。
// 让 realpathSync 直接返回原路径（不解析 junction），可让 vite 始终用 C: 路径，避开空格 bug。
const realRealpath = fs.realpathSync;
(fs as any).realpathSync = (p: any, opts?: any) => {
  if (typeof p === 'string') return p;
  return (realRealpath as any).call(fs, p, opts);
};
(fs as any).realpathSync.native = (p: any, opts?: any) => {
  if (typeof p === 'string') return p;
  return (realRealpath as any).native.call(fs, p, opts);
};

// 独立的 vitest 配置：复用 vite 的 react 插件与 @ 别名，启用 jsdom 环境以测试 React 组件。
// 不使用集中 setup 文件（setupFiles 路径解析在跨盘符场景下不稳定），
// 改为在每个测试文件顶部直接 import '@testing-library/jest-dom/vitest'。
const root = process.cwd();
export default defineConfig({
  plugins: [react()],
  root,
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
    preserveSymlinks: true,
  },
  server: {
    fs: { strict: false },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/svg.ts', 'src/pages/HomePage/HomePage.tsx'],
    },
  },
});
