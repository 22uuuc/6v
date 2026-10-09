// EXPORTS: MoyingMascot（墨影书灵 · 动漫IP吉祥物组件）
// 手绘风小墨猫书灵：漂浮 / 眨眼 / 三种表情（reading 读书、happy 开心、sleepy 困倦）
// 用于首页 Hero、空状态、加载与品牌触点，贯穿全站 IP 化

interface Props {
  mood?: 'reading' | 'happy' | 'sleepy';
  size?: number;
  className?: string;
}

export default function MoyingMascot({ mood = 'reading', size = 96, className }: Props) {
  const eye = mood === 'sleepy' ? (
    // 半闭眼
    <g>
      <path d="M30 46 q4 3 8 0" stroke="#ffd27f" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M58 46 q4 3 8 0" stroke="#ffd27f" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </g>
  ) : (
    // 圆眼 + 眨眼动画
    <g>
      <circle cx="34" cy="44" r="5.2" fill="#ffd27f">
        <animate attributeName="ry" values="5.2;5.2;0.6;5.2" keyTimes="0;0.88;0.92;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="62" cy="44" r="5.2" fill="#ffd27f">
        <animate attributeName="ry" values="5.2;5.2;0.6;5.2" keyTimes="0;0.88;0.92;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="35.4" cy="42.6" r="1.7" fill="#241b33" />
      <circle cx="63.4" cy="42.6" r="1.7" fill="#241b33" />
      <circle cx="36" cy="40.6" r="0.8" fill="#fff" opacity="0.9" />
      <circle cx="64" cy="40.6" r="0.8" fill="#fff" opacity="0.9" />
    </g>
  );

  const mouth = mood === 'happy' ? (
    <path d="M42 53 q6 5 12 0" stroke="#3b2f4f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  ) : (
    <path d="M44 54 q4 2.6 8 0" stroke="#3b2f4f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="墨影书灵"
    >
      {/* 尾巴 */}
      <path d="M74 74 q16 -2 12 -16 q-2 -8 -12 -6" stroke="#6d5a9e" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* 身体 */}
      <ellipse cx="48" cy="62" rx="30" ry="26" fill="url(#moyingBody)" />
      {/* 肚皮 */}
      <ellipse cx="48" cy="68" rx="16" ry="14" fill="#efe9ff" opacity="0.9" />
      {/* 耳朵 */}
      <path d="M22 34 L16 12 L36 24 Z" fill="#7b67b5" />
      <path d="M22 32 L19 18 L33 26 Z" fill="#ffb3c7" />
      <path d="M74 34 L80 12 L60 24 Z" fill="#7b67b5" />
      <path d="M74 32 L77 18 L63 26 Z" fill="#ffb3c7" />
      {/* 呆毛 */}
      <path d="M48 10 q-2 -7 4 -9 q5 -1 1 5" stroke="#7b67b5" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* 脸 */}
      <ellipse cx="48" cy="42" rx="26" ry="22" fill="#5b4a8c" />
      {/* 眼睛 */}
      {eye}
      {/* 腮红 */}
      {mood !== 'sleepy' && (
        <g opacity="0.85">
          <ellipse cx="24" cy="52" rx="4" ry="2.6" fill="#ff9db4" />
          <ellipse cx="72" cy="52" rx="4" ry="2.6" fill="#ff9db4" />
        </g>
      )}
      {/* 嘴 */}
      {mouth}
      {/* 手里的书（读书 / 开心时抱书） */}
      {mood !== 'sleepy' && (
        <g transform="rotate(-6 48 80)">
          <rect x="38" y="76" width="20" height="14" rx="2" fill="#f2e7c9" />
          <rect x="38" y="76" width="20" height="3" rx="1.5" fill="#c9a86a" />
          <line x1="48" y1="79" x2="48" y2="90" stroke="#c9a86a" strokeWidth="1.4" />
          <rect x="41" y="82" width="4.5" height="3" rx="0.8" fill="#d9c9a5" />
          <rect x="50.5" y="82" width="4.5" height="3" rx="0.8" fill="#d9c9a5" />
          <rect x="41" y="86.5" width="4.5" height="3" rx="0.8" fill="#d9c9a5" />
          <rect x="50.5" y="86.5" width="4.5" height="3" rx="0.8" fill="#d9c9a5" />
        </g>
      )}
      {/* 渐变定义 */}
      <defs>
        <linearGradient id="moyingBody" x1="18" y1="36" x2="78" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8a76c4" />
          <stop offset="1" stopColor="#4a3a7a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
