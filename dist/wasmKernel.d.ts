import type { WasmForceKernel } from "./types.js";
export declare class JsEdgeAttractionKernel implements WasmForceKernel {
    isReady(): boolean;
    applyEdgeAttraction(x: Float64Array<ArrayBufferLike>, y: Float64Array<ArrayBufferLike>, mass: Float64Array<ArrayBufferLike>, ax: Float64Array<ArrayBufferLike>, ay: Float64Array<ArrayBufferLike>, edgeSource: Uint32Array<ArrayBufferLike>, edgeTarget: Uint32Array<ArrayBufferLike>, edgeWeight: Float32Array<ArrayBufferLike>, edgeCount: number, springLength: number, springStrength: number, minDistance: number, activeMask: Uint8Array<ArrayBufferLike>): void;
}
export declare class ExternalWasmEdgeKernel implements WasmForceKernel {
    private readonly delegate;
    private ready;
    constructor(delegate: WasmForceKernel);
    isReady(): boolean;
    applyEdgeAttraction(x: Float64Array<ArrayBufferLike>, y: Float64Array<ArrayBufferLike>, mass: Float64Array<ArrayBufferLike>, ax: Float64Array<ArrayBufferLike>, ay: Float64Array<ArrayBufferLike>, edgeSource: Uint32Array<ArrayBufferLike>, edgeTarget: Uint32Array<ArrayBufferLike>, edgeWeight: Float32Array<ArrayBufferLike>, edgeCount: number, springLength: number, springStrength: number, minDistance: number, activeMask: Uint8Array<ArrayBufferLike>): void;
}
export declare function createBestAvailableKernel(externalWasmKernel?: WasmForceKernel): WasmForceKernel;
