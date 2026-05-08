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
    // 1280×720 covers both desktop and mobile well. 1920×1080 was overkill —
    // MediaPipe HandLandmarker downscales internally anyway, and 1080p frames
    // on mobile CPUs make inference take 200–500ms per frame, which makes
    // hand tracking effectively non-functional on phones.
    sharedStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
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
