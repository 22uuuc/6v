// EXPORTS: SvgFrame（组件文件）

/** 渲染自生成的 SVG 字符串 */
export default function SvgFrame({ svg, className }: { svg: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
