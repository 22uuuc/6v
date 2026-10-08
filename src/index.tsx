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

// 云端内容库：首次打开自动从 GitHub 仓库拉取共享书城（失败静默，保留本地种子）
import { cloud } from '@/lib/cloud';
void cloud.initAutoPull();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.MIAODA_CLIENT_BASE_PATH || '/'}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
