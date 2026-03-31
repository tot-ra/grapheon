export class CanvasPanZoomController {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.dragging = false;
        this.dragMode = "pan";
        this.lastX = 0;
        this.lastY = 0;
        this.minScale = options.minScale ?? 0.08;
        this.maxScale = options.maxScale ?? 8;
        this.zoomFactor = options.zoomFactor ?? 1.12;
        this.rotateFactor = options.rotateFactor ?? 0.01;
        this.scale = options.initialScale ?? 1;
        this.offsetX = options.initialOffsetX ?? 0;
        this.offsetY = options.initialOffsetY ?? 0;
        this.rotationX = options.initialRotationX ?? -0.45;
        this.rotationY = options.initialRotationY ?? 0.55;
        this.rotationZ = options.initialRotationZ ?? 0;
        this.canvas.style.touchAction = "none";
        this.bind();
    }
    getTransform() {
        return {
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            scale: this.scale,
            rotationX: this.rotationX,
            rotationY: this.rotationY,
            rotationZ: this.rotationZ,
        };
    }
    setTransform(transform) {
        if (transform.scale !== undefined) {
            this.scale = Math.max(this.minScale, Math.min(this.maxScale, transform.scale));
        }
        if (transform.offsetX !== undefined) {
            this.offsetX = transform.offsetX;
        }
        if (transform.offsetY !== undefined) {
            this.offsetY = transform.offsetY;
        }
        if (transform.rotationX !== undefined) {
            this.rotationX = CanvasPanZoomController.clampPitch(transform.rotationX);
        }
        if (transform.rotationY !== undefined) {
            this.rotationY = transform.rotationY;
        }
        if (transform.rotationZ !== undefined) {
            this.rotationZ = transform.rotationZ;
        }
    }
    bind() {
        this.canvas.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });
        this.canvas.addEventListener("pointerdown", (event) => {
            this.dragging = true;
            this.dragMode = event.button === 2 ? (event.shiftKey ? "roll" : "orbit") : "pan";
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
            if (this.dragMode === "orbit") {
                this.rotationY += dx * this.rotateFactor;
                this.rotationX = CanvasPanZoomController.clampPitch(this.rotationX + dy * this.rotateFactor);
                return;
            }
            if (this.dragMode === "roll") {
                this.rotationZ += dx * this.rotateFactor;
                return;
            }
            this.offsetX += dx / this.scale;
            this.offsetY += dy / this.scale;
        });
        this.canvas.addEventListener("pointerup", (event) => {
            this.dragging = false;
            this.dragMode = "pan";
            this.canvas.releasePointerCapture(event.pointerId);
        });
        this.canvas.addEventListener("pointercancel", () => {
            this.dragging = false;
            this.dragMode = "pan";
        });
        this.canvas.addEventListener("wheel", (event) => {
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
        }, { passive: false });
    }
    static clampPitch(value) {
        return Math.max(-CanvasPanZoomController.MAX_PITCH, Math.min(CanvasPanZoomController.MAX_PITCH, value));
    }
}
CanvasPanZoomController.MAX_PITCH = Math.PI / 2 - 0.01;
