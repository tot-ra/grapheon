import { describe, expect, it } from "vitest";
import { CanvasPanZoomController } from "../src/viewControls.js";

class MockCanvas extends EventTarget {
  public readonly style: { touchAction: string } = { touchAction: "" };

  public setPointerCapture(_pointerId: number): void {
    // no-op for tests
  }

  public releasePointerCapture(_pointerId: number): void {
    // no-op for tests
  }

  public getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect;
  }
}

function dispatchPointer(
  canvas: MockCanvas,
  type: string,
  init: {
    button?: number;
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    shiftKey?: boolean;
  } = {}
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    button: init.button ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerId: init.pointerId ?? 1,
    shiftKey: init.shiftKey ?? false,
  });
  canvas.dispatchEvent(event);
}

describe("CanvasPanZoomController", () => {
  it("uses right-drag to orbit in 3D-friendly pitch/yaw axes", () => {
    const canvas = new MockCanvas() as unknown as HTMLCanvasElement;
    const controller = new CanvasPanZoomController(canvas, {
      initialRotationX: -0.45,
      initialRotationY: 0.55,
      initialRotationZ: 0.1,
      rotateFactor: 0.01,
    });

    dispatchPointer(canvas as unknown as MockCanvas, "pointerdown", { button: 2, clientX: 10, clientY: 10 });
    dispatchPointer(canvas as unknown as MockCanvas, "pointermove", { clientX: 40, clientY: -10 });

    const view = controller.getTransform();
    expect(view.rotationY).toBeCloseTo(0.85);
    expect(view.rotationX).toBeCloseTo(-0.65);
    expect(view.rotationZ).toBeCloseTo(0.1);
  });

  it("keeps roll on shift plus right-drag", () => {
    const canvas = new MockCanvas() as unknown as HTMLCanvasElement;
    const controller = new CanvasPanZoomController(canvas, {
      initialRotationX: -0.45,
      initialRotationY: 0.55,
      initialRotationZ: 0.1,
      rotateFactor: 0.01,
    });

    dispatchPointer(canvas as unknown as MockCanvas, "pointerdown", {
      button: 2,
      clientX: 10,
      clientY: 10,
      shiftKey: true,
    });
    dispatchPointer(canvas as unknown as MockCanvas, "pointermove", { clientX: 40, clientY: -10 });

    const view = controller.getTransform();
    expect(view.rotationX).toBeCloseTo(-0.45);
    expect(view.rotationY).toBeCloseTo(0.55);
    expect(view.rotationZ).toBeCloseTo(0.4);
  });

  it("clamps pitch to avoid flipping over", () => {
    const canvas = new MockCanvas() as unknown as HTMLCanvasElement;
    const controller = new CanvasPanZoomController(canvas, {
      initialRotationX: 0,
      rotateFactor: 0.01,
    });

    dispatchPointer(canvas as unknown as MockCanvas, "pointerdown", { button: 2, clientX: 0, clientY: 0 });
    dispatchPointer(canvas as unknown as MockCanvas, "pointermove", { clientX: 0, clientY: 500 });

    expect(controller.getTransform().rotationX).toBeCloseTo(Math.PI / 2 - 0.01);
  });
});
