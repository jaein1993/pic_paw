declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    workerScript?: string;
    width?: number;
    height?: number;
    repeat?: number;
    background?: string;
    transparent?: number | null;
    debug?: boolean;
    dither?: 'FloydSteinberg' | 'FalseFloydSteinberg' | 'Stucki' | 'Atkinson' | boolean;
  }
  interface FrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }
  type GIFEvent = 'start' | 'progress' | 'finished' | 'abort';
  class GIF {
    constructor(options: GIFOptions);
    addFrame(image: CanvasImageSource | ImageData, options?: FrameOptions): void;
    on(event: 'progress', cb: (progress: number) => void): void;
    on(event: 'finished', cb: (blob: Blob) => void): void;
    on(event: 'abort' | 'start', cb: () => void): void;
    on(event: GIFEvent, cb: (...args: unknown[]) => void): void;
    render(): void;
    abort(): void;
  }
  export default GIF;
}
