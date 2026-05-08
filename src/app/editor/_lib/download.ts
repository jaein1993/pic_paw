function clickDownloadLink(href: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadDataURL(
  dataURL: string,
  filename = `photo_${Date.now()}.png`,
): Promise<void> {
  clickDownloadLink(dataURL, filename);
}

// `mimeType` arg is kept for call-site compatibility; the browser infers
// download type from the blob URL or filename extension.
export async function downloadBlob(
  blob: Blob,
  filename: string,
  _mimeType?: string,
): Promise<void> {
  void _mimeType;
  const url = URL.createObjectURL(blob);
  clickDownloadLink(url, filename);
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
