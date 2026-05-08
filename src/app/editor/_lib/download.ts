export async function downloadDataURL(dataURL: string, filename = `photo_${Date.now()}.png`): Promise<void> {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataURL;
  link.click();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareDataURL(dataURL: string, filename = 'photo.png'): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    const res = await fetch(dataURL);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '사진 공유' });
      return true;
    }
  } catch {
    // share cancelled or failed — fall through
  }
  return false;
}

export async function copyDataURLToClipboard(dataURL: string): Promise<boolean> {
  try {
    const res = await fetch(dataURL);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
