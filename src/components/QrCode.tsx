// EXPORTS: QrCode（收款二维码：把内容串渲染为可扫码二维码）
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: '#17141f', light: '#ffffff' } })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl('');
      });
    return () => {
      alive = false;
    };
  }, [text, size]);

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        二维码生成中…
      </div>
    );
  }
  return <img src={dataUrl} alt="收款二维码" style={{ width: size, height: size }} className="rounded-lg" />;
}
