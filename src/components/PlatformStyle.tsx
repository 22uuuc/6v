// EXPORTS: PlatformStyle（组件文件）——全站排版风格应用
// 读取平台设置（管理员后台可替换）：排版风格 / 默认字体 / 字号 / 行距，
// 叠加当前用户的个性化偏好（字体/字号/行距），覆盖 :root CSS 变量即时生效。
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { applyPlatformStyle } from '@/lib/platform-style';
import { useDataVersion } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth-context';

export default function PlatformStyle() {
  const version = useDataVersion();
  const { user } = useAuth();

  useEffect(() => {
    const s = api.getSettings();
    const prefs = user ? api.getPrefs(user.id) : null;
    const cleanup = applyPlatformStyle(
      s.layoutStyle ?? 'anime',
      prefs?.fontFamily ?? s.fontFamily ?? 'system',
      prefs?.fontSize ?? s.fontSize ?? 18,
      prefs?.lineHeight ?? s.lineHeight ?? 1.9,
    );
    return cleanup;
    // user 为 AuthProvider 稳定引用，仅在 id 变化时重新应用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, user?.id]);

  return null;
}
