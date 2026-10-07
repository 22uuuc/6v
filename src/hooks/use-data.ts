// EXPORTS: useDataVersion

import { useSyncExternalStore } from 'react';
import { subscribe, getVersion } from '@/lib/store';

/**
 * 订阅全局数据版本：任何写操作 notify() 后触发重渲染。
 * 派生数据直接在渲染期调用 api 计算（版本不变则结果确定）。
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}
