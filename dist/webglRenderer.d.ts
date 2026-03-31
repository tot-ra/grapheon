import type { DrawOptions, RenderSnapshot } from "./types.js";
import { ForceGraph } from "./forceGraph.js";
export declare class WebGLForceGraphRenderer {
    private readonly canvas;
    private readonly gl;
    private readonly program;
    private readonly positionBuffer;
    private readonly colorBuffer;
    private readonly sizeBuffer;
    private readonly aPosition;
    private readonly aColor;
    private readonly aPointSize;
    private readonly uViewport;
    private readonly uNodeShape;
    private readonly uRenderMode;
    constructor(canvas: HTMLCanvasElement);
    draw<T extends string | number>(graph: ForceGraph<T>, options: DrawOptions): void;
    drawSnapshot(snapshot: RenderSnapshot, options: DrawOptions): void;
    private shapeToNumber;
    private projectPositions;
    private expandEdgeGeometry;
    private bindAttributeBuffer;
    private compile;
}
