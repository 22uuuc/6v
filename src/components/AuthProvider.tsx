// EXPORTS: AuthProvider（组件文件，禁止导出其他内容）
import type { ReactNode } from 'react';
import { AuthContext } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useDataVersion } from '@/hooks/use-data';

export default function AuthProvider({ children }: { children: ReactNode }) {
  useDataVersion();
  const user = api.getSession();
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}
