// Module-level shared stream so multiple steps (Step 2 preview + Step 3
// booth) can attach the SAME camera to their <video> elements without each
// triggering a separate getUserMedia (= second permission prompt on iOS /
// in-app browsers).
let sharedStream: MediaStream | null = null;

export async function startCamera(
  videoEl: HTMLVideoElement,
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> {
  if (!sharedStream || !sharedStream.active) {
    // 1920×1080 ideal — modern phones deliver this without trouble and the
    // photo cell quality benefits from the extra detail. `ideal` is a soft
    // constraint so older devices fall back automatically (e.g. to 720p)
    // without breaking the stream. HandLandmarker downscales internally and
    // CPU delegate handles 1080p fine on current-gen mobiles.
    sharedStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  }
  videoEl.srcObject = sharedStream;
  await videoEl.play();
  return sharedStream;
}

// Stop a stream we own. Use releaseSharedCamera() when leaving the editor
// flow entirely; per-step cleanup should NOT stop the shared stream or the
// next step has to ask for permission again.
export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
  if (stream === sharedStream) sharedStream = null;
}

export function releaseSharedCamera(): void {
  if (sharedStream) {
    sharedStream.getTracks().forEach((t) => t.stop());
    sharedStream = null;
  }
}

export function captureFrame(videoEl: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(videoEl, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function getOppositeCamera(
  current: 'user' | 'environment'
): 'user' | 'environment' {
  return current === 'user' ? 'environment' : 'user';
}
