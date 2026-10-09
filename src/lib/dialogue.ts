// EXPORTS: IDialogueLine, parseDialogue, serializeDialogue
// 对话小说正文格式：每行一条消息 `说话人|台词|L或R`（L=对方靠左，R=主角靠右）

export interface IDialogueLine {
  speaker: string;
  text: string;
  side: 'L' | 'R';
}

/** 解析对话小说章节正文（容错：非法行跳过，缺失方向默认左） */
export function parseDialogue(content: string): IDialogueLine[] {
  return content
    .split('\n')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const parts = raw.split('|');
      if (parts.length < 2) return null;
      const [speaker, text, side] = parts;
      if (!speaker.trim() || !text.trim()) return null;
      return { speaker: speaker.trim(), text: text.trim(), side: side?.trim().toUpperCase() === 'R' ? 'R' : 'L' } as IDialogueLine;
    })
    .filter((l): l is IDialogueLine => l !== null);
}

/** 序列化气泡列表为章节正文存储格式 */
export function serializeDialogue(lines: IDialogueLine[]): string {
  return lines
    .filter((l) => l.speaker.trim() && l.text.trim())
    .map((l) => `${l.speaker.trim()}|${l.text.trim()}|${l.side}`)
    .join('\n');
}
