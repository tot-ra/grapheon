export interface PanZoomOptions {
  minScale?: number;
  maxScale?: number;
  zoomFactor?: number;
  initialScale?: number;
  initialOffsetX?: number;
  initialOffsetY?: number;
}

export interface ViewTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export class CanvasPanZoomController {
  private offsetX: number;
  private offsetY: number;
  private scale: number;
  private readonly minScale: number;
  private readonly maxScale: number;
  private readonly zoomFactor: number;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  public constructor(private readonly canvas: HTMLCanvasElement, options: PanZoomOptions = {}) {
    this.minScale = options.minScale ?? 0.08;
    this.maxScale = options.maxScale ?? 8;
    this.zoomFactor = options.zoomFactor ?? 1.12;
    this.scale = options.initialScale ?? 1;
    this.offsetX = options.initialOffsetX ?? 0;
    this.offsetY = options.initialOffsetY ?? 0;

    this.canvas.style.touchAction = "none";
    this.bind();
  }

  public getTransform(): ViewTransform {
    return {
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      scale: this.scale,
    };
  }

  public setTransform(transform: Partial<ViewTransform>): void {
    if (transform.scale !== undefined) {
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, transform.scale));
    }
    if (transform.offsetX !== undefined) {
      this.offsetX = transform.offsetX;
    }
    if (transform.offsetY !== undefined) {
      this.offsetY = transform.offsetY;
    }
  }

  private bind(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }

      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      this.offsetX += dx / this.scale;
      this.offsetY += dy / this.scale;
    });

    this.canvas.addEventListener("pointerup", (event) => {
      this.dragging = false;
      this.canvas.releasePointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.dragging = false;
    });

    this.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const cx = event.clientX - rect.left;
        const cy = event.clientY - rect.top;

        const zoomIn = event.deltaY < 0;
        const nextScale = zoomIn ? this.scale * this.zoomFactor : this.scale / this.zoomFactor;
        const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, nextScale));

        if (clampedScale === this.scale) {
          return;
        }

        this.offsetX = this.offsetX + cx / clampedScale - cx / this.scale;
        this.offsetY = this.offsetY + cy / clampedScale - cy / this.scale;
        this.scale = clampedScale;
      },
      { passive: false }
    );
  }
}
