import type Konva from 'konva';

interface ExportOptions {
  pixelRatio?: number;
}

export function exportStageToDataURL(
  stage: Konva.Stage,
  options: ExportOptions = {}
): string {
  return stage.toDataURL({ pixelRatio: options.pixelRatio ?? 2 });
}

export function calcCanvasSize(
  containerWidth: number,
  containerHeight: number,
  maxWidth = 720
): { width: number; height: number } {
  const width = Math.min(containerWidth, maxWidth);
  const height = containerHeight > 0 ? Math.min(containerHeight, maxWidth) : width;
  return { width, height };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
