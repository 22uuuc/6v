import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/ErrorFallback';
import App from './app';
import './index.css';

// 启动防篡改守护：定时巡检 + 跨标签页写入监控（见 src/lib/guard.ts）
import { startGuard } from '@/lib/guard';
startGuard(30000);

// 云端内容库：每次打开都自动从固定渠道（写死于代码的 GitHub 仓库，见 cloud.ts CLOUD_CHANNEL）增量拉取共享书城
// 架构：后端管理员控制 → GitHub 数据库中转 → 前端只读提取（匿名拉取，失败静默保留本地兜底）
import { cloud } from '@/lib/cloud';
void cloud.initAutoPull();

// PWA：注册 Service Worker（供安装到手机 / 桌面，离线回退壳缓存）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const base = import.meta.env.MIAODA_CLIENT_BASE_PATH || '/';
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => null);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.MIAODA_CLIENT_BASE_PATH || '/'}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
