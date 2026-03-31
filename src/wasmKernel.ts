import type { WasmForceKernel } from "./types.js";

export class JsEdgeAttractionKernel implements WasmForceKernel {
  public isReady(): boolean {
    return true;
  }

  public applyEdgeAttraction(
    x: Float64Array<ArrayBufferLike>,
    y: Float64Array<ArrayBufferLike>,
    mass: Float64Array<ArrayBufferLike>,
    ax: Float64Array<ArrayBufferLike>,
    ay: Float64Array<ArrayBufferLike>,
    edgeSource: Uint32Array<ArrayBufferLike>,
    edgeTarget: Uint32Array<ArrayBufferLike>,
    edgeWeight: Float32Array<ArrayBufferLike>,
    edgeCount: number,
    springLength: number,
    springStrength: number,
    minDistance: number,
    activeMask: Uint8Array<ArrayBufferLike>
  ): void {
    for (let i = 0; i < edgeCount; i += 1) {
      const source = edgeSource[i];
      const target = edgeTarget[i];

      if (activeMask[source] === 0 && activeMask[target] === 0) {
        continue;
      }

      const dx = x[target] - x[source];
      const dy = y[target] - y[source];
      const distSq = dx * dx + dy * dy + minDistance * minDistance;
      const dist = Math.sqrt(distSq);
      const weight = edgeWeight[i] || 1;
      const force = springStrength * weight * (dist - springLength);
      const ux = dx / dist;
      const uy = dy / dist;
      const fx = force * ux;
      const fy = force * uy;

      if (activeMask[source] !== 0) {
        ax[source] += fx / mass[source];
        ay[source] += fy / mass[source];
      }

      if (activeMask[target] !== 0) {
        ax[target] -= fx / mass[target];
        ay[target] -= fy / mass[target];
      }
    }
  }
}

export class ExternalWasmEdgeKernel implements WasmForceKernel {
  private ready = false;

  public constructor(
    private readonly delegate: WasmForceKernel
  ) {
    this.ready = delegate.isReady();
  }

  public isReady(): boolean {
    return this.ready;
  }

  public applyEdgeAttraction(
    x: Float64Array<ArrayBufferLike>,
    y: Float64Array<ArrayBufferLike>,
    mass: Float64Array<ArrayBufferLike>,
    ax: Float64Array<ArrayBufferLike>,
    ay: Float64Array<ArrayBufferLike>,
    edgeSource: Uint32Array<ArrayBufferLike>,
    edgeTarget: Uint32Array<ArrayBufferLike>,
    edgeWeight: Float32Array<ArrayBufferLike>,
    edgeCount: number,
    springLength: number,
    springStrength: number,
    minDistance: number,
    activeMask: Uint8Array<ArrayBufferLike>
  ): void {
    this.delegate.applyEdgeAttraction(
      x,
      y,
      mass,
      ax,
      ay,
      edgeSource,
      edgeTarget,
      edgeWeight,
      edgeCount,
      springLength,
      springStrength,
      minDistance,
      activeMask
    );
  }
}

export function createBestAvailableKernel(externalWasmKernel?: WasmForceKernel): WasmForceKernel {
  if (externalWasmKernel && externalWasmKernel.isReady()) {
    return new ExternalWasmEdgeKernel(externalWasmKernel);
  }

  return new JsEdgeAttractionKernel();
}
