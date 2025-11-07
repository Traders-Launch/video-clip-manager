import { Clip } from '@/types';
import { hexToRgb } from './utils';

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  textOverlay: NonNullable<Clip['textOverlay']>
) {
  const { content, position, fontSize, textColor, bgColor, bgOpacity, fontWeight } = textOverlay;

  ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = content.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  let startY: number;
  if (position === 'top') {
    startY = totalHeight / 2 + 40;
  } else if (position === 'bottom') {
    startY = canvas.height - totalHeight / 2 - 40;
  } else {
    startY = canvas.height / 2;
  }

  lines.forEach((line, index) => {
    const y = startY + (index - (lines.length - 1) / 2) * lineHeight;
    const textMetrics = ctx.measureText(line);
    const textWidth = textMetrics.width;
    const padding = 20;

    if (bgOpacity > 0) {
      const rgb = hexToRgb(bgColor);
      if (rgb) {
        const bgAlpha = bgOpacity / 100;
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${bgAlpha})`;
        ctx.fillRect(
          canvas.width / 2 - textWidth / 2 - padding,
          y - fontSize / 2 - padding / 2,
          textWidth + padding * 2,
          lineHeight
        );
      }
    }

    ctx.fillStyle = textColor;
    ctx.fillText(line, canvas.width / 2, y);
  });
}
