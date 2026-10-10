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

// 后端权威接入：启动时探测本地后端（127.0.0.1:8787），成功后进入远程模式（数据经后端权限获取）
// 失败自动回退本地演示模式；安全边界：接入层纯 HTTP 客户端，不携带任何后端加密材料
import { initRemote } from '@/lib/remote';
import { notify } from '@/lib/store';
void initRemote().then(() => notify());

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
