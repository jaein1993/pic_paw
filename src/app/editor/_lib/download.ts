function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// On mobile (especially iOS Safari) the `<a download>` attribute is ignored
// and the file is opened in-place rather than saved. Use the Web Share API
// instead so the user gets a native share sheet and can pick "Save to
// Photos" / "Save to Files". Desktop falls through to the classic anchor
// click which is what users expect there.
async function tryShareFile(blob: Blob, filename: string, mimeType: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  try {
    const file = new File([blob], filename, { type: mimeType });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file] });
    return true;
  } catch {
    // User canceled or share failed; let caller fall back.
    return false;
  }
}

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
  if (isMobileUA()) {
    const res = await fetch(dataURL);
    const blob = await res.blob();
    if (await tryShareFile(blob, filename, 'image/png')) return;
  }
  clickDownloadLink(dataURL, filename);
}

export async function downloadBlob(
  blob: Blob,
  filename: string,
  mimeType?: string,
): Promise<void> {
  const type = mimeType ?? blob.type ?? 'application/octet-stream';
  if (isMobileUA() && (await tryShareFile(blob, filename, type))) return;
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
