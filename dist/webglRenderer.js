import { projectPoint } from "./forceGraph.js";
const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec4 aColor;
attribute float aPointSize;
uniform vec2 uViewport;
varying vec4 vColor;
void main() {
  vec2 clip = vec2((aPosition.x / uViewport.x) * 2.0 - 1.0, 1.0 - (aPosition.y / uViewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = aPointSize;
  vColor = aColor;
}
`;
const FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
uniform float uNodeShape;
uniform float uRenderMode;
void main() {
  if (uRenderMode > 0.5) {
    gl_FragColor = vColor;
    return;
  }
  vec2 centered = gl_PointCoord * 2.0 - 1.0;
  if (uNodeShape < 0.5) {
    if (dot(centered, centered) > 1.0) discard;
  } else if (uNodeShape < 1.5) {
  } else if (uNodeShape < 2.5) {
    if (abs(centered.x) + abs(centered.y) > 1.0) discard;
  } else {
    float edge1 = (centered.y + 1.0);
    float edge2 = 0.9 - centered.x + centered.y * 0.55;
    float edge3 = 0.9 + centered.x + centered.y * 0.55;
    if (edge1 < 0.0 || edge2 < 0.0 || edge3 < 0.0) discard;
  }
  gl_FragColor = vColor;
}
`;
function parseColor(value, fallback) {
    if (!value)
        return fallback;
    if (value.startsWith("#") && (value.length === 7 || value.length === 9)) {
        const r = parseInt(value.slice(1, 3), 16) / 255;
        const g = parseInt(value.slice(3, 5), 16) / 255;
        const b = parseInt(value.slice(5, 7), 16) / 255;
        const a = value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1;
        return [r, g, b, a];
    }
    return fallback;
}
function toColorFloats(bytes, fallback, itemCount) {
    const colors = new Float32Array(itemCount * 4);
    for (let i = 0; i < itemCount; i += 1) {
        const offset = i * 4;
        const alpha = bytes[offset + 3];
        if (alpha === 0) {
            colors[offset] = fallback[0];
            colors[offset + 1] = fallback[1];
            colors[offset + 2] = fallback[2];
            colors[offset + 3] = fallback[3];
            continue;
        }
        colors[offset] = bytes[offset] / 255;
        colors[offset + 1] = bytes[offset + 1] / 255;
        colors[offset + 2] = bytes[offset + 2] / 255;
        colors[offset + 3] = alpha / 255;
    }
    return colors;
}
export class WebGLForceGraphRenderer {
    constructor(canvas) {
        this.canvas = canvas;
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
        const colorBuffer = gl.createBuffer();
        const sizeBuffer = gl.createBuffer();
        if (!positionBuffer || !colorBuffer || !sizeBuffer) {
            throw new Error("Failed to create WebGL buffers");
        }
        this.positionBuffer = positionBuffer;
        this.colorBuffer = colorBuffer;
        this.sizeBuffer = sizeBuffer;
        this.aPosition = gl.getAttribLocation(program, "aPosition");
        this.aColor = gl.getAttribLocation(program, "aColor");
        this.aPointSize = gl.getAttribLocation(program, "aPointSize");
        const uViewport = gl.getUniformLocation(program, "uViewport");
        const uNodeShape = gl.getUniformLocation(program, "uNodeShape");
        const uRenderMode = gl.getUniformLocation(program, "uRenderMode");
        if (!uViewport || !uNodeShape || !uRenderMode) {
            throw new Error("Missing required uniforms");
        }
        this.uViewport = uViewport;
        this.uNodeShape = uNodeShape;
        this.uRenderMode = uRenderMode;
    }
    draw(graph, options) {
        const snapshot = graph.exportRenderSnapshot(options.maxDrawNodes, options.maxDrawEdges);
        this.drawSnapshot(snapshot, options);
    }
    drawSnapshot(snapshot, options) {
        const gl = this.gl;
        const width = options.width;
        const height = options.height;
        const projected = this.projectPositions(snapshot, options);
        const nodeFallbackColor = parseColor(options.nodeColor, [0.1, 0.15, 0.25, 1]);
        const edgeFallbackColor = parseColor(options.edgeColor, [0.55, 0.55, 0.6, 0.25]);
        gl.viewport(0, 0, width, height);
        gl.useProgram(this.program);
        if (options.backgroundColor) {
            const bg = parseColor(options.backgroundColor, [1, 1, 1, 1]);
            gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
        }
        else {
            gl.clearColor(1, 1, 1, 0);
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(this.uViewport, width, height);
        gl.lineWidth(options.edgeWidth ?? 1);
        if (options.drawEdges !== false && snapshot.edgeCount > 0) {
            const edgeData = this.expandEdgeGeometry(projected, snapshot, edgeFallbackColor);
            this.bindAttributeBuffer(this.positionBuffer, this.aPosition, edgeData.positions, 2);
            this.bindAttributeBuffer(this.colorBuffer, this.aColor, edgeData.colors, 4);
            this.bindAttributeBuffer(this.sizeBuffer, this.aPointSize, edgeData.sizes, 1);
            gl.uniform1f(this.uRenderMode, 1);
            gl.drawArrays(gl.LINES, 0, edgeData.positions.length / 2);
        }
        const nodeColors = toColorFloats(snapshot.nodeColors, nodeFallbackColor, snapshot.nodeCount);
        const nodeSizes = new Float32Array(snapshot.nodeCount);
        for (let i = 0; i < snapshot.nodeCount; i += 1) {
            nodeSizes[i] = Math.max(1, (snapshot.nodeRadii[i] > 0 ? snapshot.nodeRadii[i] : (options.nodeRadius ?? 2)) * projected.depthScale[i]);
        }
        this.bindAttributeBuffer(this.positionBuffer, this.aPosition, projected.positions, 2);
        this.bindAttributeBuffer(this.colorBuffer, this.aColor, nodeColors, 4);
        this.bindAttributeBuffer(this.sizeBuffer, this.aPointSize, nodeSizes, 1);
        gl.uniform1f(this.uNodeShape, this.shapeToNumber(options.nodeShape));
        gl.uniform1f(this.uRenderMode, 0);
        gl.drawArrays(gl.POINTS, 0, snapshot.nodeCount);
    }
    shapeToNumber(shape) {
        switch (shape) {
            case "square":
                return 1;
            case "diamond":
                return 2;
            case "triangle":
                return 3;
            default:
                return 0;
        }
    }
    projectPositions(snapshot, options) {
        const projected = new Float32Array(snapshot.nodeCount * 2);
        const depthScale = new Float32Array(snapshot.nodeCount);
        const scale = options.scale ?? 1;
        const offsetX = options.offsetX ?? 0;
        const offsetY = options.offsetY ?? 0;
        for (let i = 0; i < snapshot.nodeCount; i += 1) {
            const source = i * 3;
            const projectedPoint = projectPoint(snapshot.positions[source], snapshot.positions[source + 1], snapshot.positions[source + 2], options);
            projected[i * 2] = (projectedPoint.x + offsetX) * scale;
            projected[i * 2 + 1] = (projectedPoint.y + offsetY) * scale;
            depthScale[i] = projectedPoint.depthScale;
        }
        return { positions: projected, depthScale };
    }
    expandEdgeGeometry(projected, snapshot, fallbackColor) {
        const positions = new Float32Array(snapshot.edgeCount * 4);
        const colors = new Float32Array(snapshot.edgeCount * 8);
        const sizes = new Float32Array(snapshot.edgeCount * 2);
        for (let i = 0; i < snapshot.edgeCount; i += 1) {
            const src = snapshot.edgeSource[i];
            const dst = snapshot.edgeTarget[i];
            const srcOffset = src * 2;
            const dstOffset = dst * 2;
            const colorOffset = i * 8;
            const rgbaOffset = i * 4;
            const alpha = snapshot.edgeColors[rgbaOffset + 3];
            const r = alpha === 0 ? fallbackColor[0] : snapshot.edgeColors[rgbaOffset] / 255;
            const g = alpha === 0 ? fallbackColor[1] : snapshot.edgeColors[rgbaOffset + 1] / 255;
            const b = alpha === 0 ? fallbackColor[2] : snapshot.edgeColors[rgbaOffset + 2] / 255;
            const a = alpha === 0 ? fallbackColor[3] : alpha / 255;
            positions[i * 4] = projected.positions[srcOffset];
            positions[i * 4 + 1] = projected.positions[srcOffset + 1];
            positions[i * 4 + 2] = projected.positions[dstOffset];
            positions[i * 4 + 3] = projected.positions[dstOffset + 1];
            colors[colorOffset] = r;
            colors[colorOffset + 1] = g;
            colors[colorOffset + 2] = b;
            colors[colorOffset + 3] = a;
            colors[colorOffset + 4] = r;
            colors[colorOffset + 5] = g;
            colors[colorOffset + 6] = b;
            colors[colorOffset + 7] = a;
            sizes[i * 2] = 1;
            sizes[i * 2 + 1] = 1;
        }
        return { positions, colors, sizes };
    }
    bindAttributeBuffer(buffer, location, data, size) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }
    compile(type, source) {
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
