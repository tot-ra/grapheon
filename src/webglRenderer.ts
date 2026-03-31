import type { DrawOptions, RenderSnapshot } from "./types.js";
import { ForceGraph } from "./forceGraph.js";

const VERTEX_SHADER = `
attribute vec2 aPosition;
uniform vec2 uViewport;
uniform vec2 uOffset;
uniform float uScale;
uniform float uPointSize;
void main() {
  vec2 p = (aPosition + uOffset) * uScale;
  vec2 clip = vec2((p.x / uViewport.x) * 2.0 - 1.0, 1.0 - (p.y / uViewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec4 uColor;
void main() {
  gl_FragColor = uColor;
}
`;

function parseColor(value: string | undefined, fallback: [number, number, number, number]): [number, number, number, number] {
  if (!value) return fallback;
  if (value.startsWith("#") && (value.length === 7 || value.length === 9)) {
    const r = parseInt(value.slice(1, 3), 16) / 255;
    const g = parseInt(value.slice(3, 5), 16) / 255;
    const b = parseInt(value.slice(5, 7), 16) / 255;
    const a = value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1;
    return [r, g, b, a];
  }
  return fallback;
}

export class WebGLForceGraphRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly edgeBuffer: WebGLBuffer;

  private readonly aPosition: number;
  private readonly uViewport: WebGLUniformLocation;
  private readonly uOffset: WebGLUniformLocation;
  private readonly uScale: WebGLUniformLocation;
  private readonly uPointSize: WebGLUniformLocation;
  private readonly uColor: WebGLUniformLocation;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
    if (!gl) {
      throw new Error("WebGL not available");
    }

    this.gl = gl;
    const vertexShader = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Failed to create WebGL program");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
    }

    this.program = program;
    const positionBuffer = gl.createBuffer();
    const edgeBuffer = gl.createBuffer();
    if (!positionBuffer || !edgeBuffer) {
      throw new Error("Failed to create WebGL buffers");
    }
    this.positionBuffer = positionBuffer;
    this.edgeBuffer = edgeBuffer;

    this.aPosition = gl.getAttribLocation(program, "aPosition");
    const uViewport = gl.getUniformLocation(program, "uViewport");
    const uOffset = gl.getUniformLocation(program, "uOffset");
    const uScale = gl.getUniformLocation(program, "uScale");
    const uPointSize = gl.getUniformLocation(program, "uPointSize");
    const uColor = gl.getUniformLocation(program, "uColor");

    if (!uViewport || !uOffset || !uScale || !uPointSize || !uColor) {
      throw new Error("Missing required uniforms");
    }

    this.uViewport = uViewport;
    this.uOffset = uOffset;
    this.uScale = uScale;
    this.uPointSize = uPointSize;
    this.uColor = uColor;
  }

  public draw<T extends string | number>(graph: ForceGraph<T>, options: DrawOptions): void {
    const snapshot = graph.exportRenderSnapshot(options.maxDrawNodes, options.maxDrawEdges);
    this.drawSnapshot(snapshot, options);
  }

  public drawSnapshot(snapshot: RenderSnapshot, options: DrawOptions): void {
    const gl = this.gl;
    const width = options.width;
    const height = options.height;

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    if (options.backgroundColor) {
      const bg = parseColor(options.backgroundColor, [1, 1, 1, 1]);
      gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    } else {
      gl.clearColor(1, 1, 1, 0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(this.uViewport, width, height);
    gl.uniform2f(this.uOffset, options.offsetX ?? 0, options.offsetY ?? 0);
    gl.uniform1f(this.uScale, options.scale ?? 1);

    if (options.drawEdges !== false && snapshot.edgeCount > 0) {
      const edgePositions = this.expandEdgePositions(snapshot.positions, snapshot.edgeSource, snapshot.edgeTarget);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, edgePositions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aPosition);
      gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

      const edgeColor = parseColor(options.edgeColor, [0.55, 0.55, 0.6, 0.25]);
      gl.uniform4f(this.uColor, edgeColor[0], edgeColor[1], edgeColor[2], edgeColor[3]);
      gl.uniform1f(this.uPointSize, 1);
      gl.drawArrays(gl.LINES, 0, edgePositions.length / 2);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, snapshot.positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    const nodeColor = parseColor(options.nodeColor, [0.1, 0.15, 0.25, 1]);
    gl.uniform4f(this.uColor, nodeColor[0], nodeColor[1], nodeColor[2], nodeColor[3]);
    gl.uniform1f(this.uPointSize, options.nodeRadius ?? 2);
    gl.drawArrays(gl.POINTS, 0, snapshot.nodeCount);
  }

  private expandEdgePositions(positions: Float32Array, edgeSource: Uint32Array, edgeTarget: Uint32Array): Float32Array {
    const edgePositions = new Float32Array(edgeSource.length * 4);
    for (let i = 0; i < edgeSource.length; i += 1) {
      const src = edgeSource[i] * 2;
      const dst = edgeTarget[i] * 2;

      edgePositions[i * 4] = positions[src];
      edgePositions[i * 4 + 1] = positions[src + 1];
      edgePositions[i * 4 + 2] = positions[dst];
      edgePositions[i * 4 + 3] = positions[dst + 1];
    }
    return edgePositions;
  }

  private compile(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error("Failed to create shader");
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) ?? "Shader compile failed");
    }

    return shader;
  }
}
