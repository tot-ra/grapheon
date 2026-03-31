export interface PanZoomOptions {
    minScale?: number;
    maxScale?: number;
    zoomFactor?: number;
    rotateFactor?: number;
    initialScale?: number;
    initialOffsetX?: number;
    initialOffsetY?: number;
    initialRotationX?: number;
    initialRotationY?: number;
    initialRotationZ?: number;
}
export interface ViewTransform {
    offsetX: number;
    offsetY: number;
    scale: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
}
export declare class CanvasPanZoomController {
    private readonly canvas;
    private static readonly MAX_PITCH;
    private offsetX;
    private offsetY;
    private scale;
    private rotationX;
    private rotationY;
    private rotationZ;
    private readonly minScale;
    private readonly maxScale;
    private readonly zoomFactor;
    private readonly rotateFactor;
    private dragging;
    private dragMode;
    private lastX;
    private lastY;
    constructor(canvas: HTMLCanvasElement, options?: PanZoomOptions);
    getTransform(): ViewTransform;
    setTransform(transform: Partial<ViewTransform>): void;
    private bind;
    private static clampPitch;
}
