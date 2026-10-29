import { useEffect, useRef, useState } from 'react';
import { coverFromBlobImage } from '../cover';
import type { ViewerProps } from './types';

export default function ImageViewer({ file, scale, onInfo, onError, onCover }: ViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const cbs = useRef({ onInfo, onError, onCover });
  cbs.current = { onInfo, onError, onCover };

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setSize(null);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className="sd-pages">
      {url && (
        <div data-sd-page="1" className="sd-page sd-photo" style={size ? { width: size.w * scale, height: size.h * scale } : { opacity: 0 }}>
          <img
            src={url}
            alt={file.name}
            decoding="async"
            draggable={false}
            className="block size-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              const w = img.naturalWidth || 800;
              const h = img.naturalHeight || 600;
              setSize({ w, h });
              cbs.current.onInfo({ pages: 1, pageWidth: w, pageHeight: h });
              if (cbs.current.onCover) void coverFromBlobImage(file).then((b) => b && cbs.current.onCover?.(b));
            }}
            onError={() => cbs.current.onError('This image couldn’t be opened.')}
          />
        </div>
      )}
    </div>
  );
}
