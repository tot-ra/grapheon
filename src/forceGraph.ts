import { BarnesHutTree } from "./quadtree.js";
import type {
  AdaptiveDrawOptions,
  DrawOptions,
  GraphNodeInput,
  NodeId,
  RenderSnapshot,
  SimulationOptions,
  StepSummary,
  WasmForceKernel,
} from "./types.js";

const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  springLength: 24,
  springStrength: 0.08,
  repulsionStrength: 180,
  gravity: 0.003,
  damping: 0.9,
  theta: 0.8,
  timeStep: 0.35,
  minDistance: 0.01,
  maxSpeed: 6,
  initialSpread: 500,
  activeSetEnabled: true,
  sleepVelocityThreshold: 0.02,
  coldNodeUpdateInterval: 7,
  inactiveVelocityDamping: 0.96,
  adaptiveThetaEnabled: true,
  adaptiveThetaMin: 0.65,
  adaptiveThetaMax: 1.15,
  adaptiveTargetFrameMs: 16,
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export class ForceGraph<T extends NodeId = string> {
  private readonly options: SimulationOptions;
  private readonly idToIndex = new Map<T, number>();
  private readonly ids: T[] = [];

  private nodeCapacity = 0;
  private nodeCountValue = 0;
  private x: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private y: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private vx: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private vy: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private ax: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private ay: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private mass: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private activeMask: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  private edgeCapacity = 0;
  private edgeCountValue = 0;
  private edgeSource: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
  private edgeTarget: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
  private edgeWeight: Float32Array<ArrayBufferLike> = new Float32Array(0);

  private tree: BarnesHutTree;
  private nodeIndexes: number[] = [];
  private iteration = 0;
  private currentTheta: number;
  private wasmKernel: WasmForceKernel | null = null;

  public constructor(options: Partial<SimulationOptions> = {}) {
    this.options = { ...DEFAULT_SIMULATION_OPTIONS, ...options };
    this.currentTheta = this.options.theta;
    this.tree = new BarnesHutTree(this, this.options.minDistance);
  }

  public get nodeCount(): number {
    return this.nodeCountValue;
  }

  public get edgeCount(): number {
    return this.edgeCountValue;
  }

  public setWasmKernel(kernel: WasmForceKernel | null): void {
    this.wasmKernel = kernel;
  }

  public addNode(id: T, input: GraphNodeInput = {}): number {
    const existing = this.idToIndex.get(id);
    if (existing !== undefined) {
      if (input.x !== undefined) this.x[existing] = input.x;
      if (input.y !== undefined) this.y[existing] = input.y;
      if (input.mass !== undefined) this.mass[existing] = Math.max(0.01, input.mass);
      return existing;
    }

    const index = this.nodeCountValue;
    this.ensureNodeCapacity(index + 1);

    const spread = this.options.initialSpread;
    this.x[index] = input.x ?? (Math.random() * 2 - 1) * spread;
    this.y[index] = input.y ?? (Math.random() * 2 - 1) * spread;
    this.vx[index] = 0;
    this.vy[index] = 0;
    this.ax[index] = 0;
    this.ay[index] = 0;
    this.mass[index] = Math.max(0.01, input.mass ?? 1);
    this.activeMask[index] = 1;

    this.ids.push(id);
    this.idToIndex.set(id, index);
    this.nodeCountValue += 1;
    return index;
  }

  public addEdge(sourceId: T, targetId: T, weight = 1): number {
    const source = this.addNode(sourceId);
    const target = this.addNode(targetId);

    this.ensureEdgeCapacity(this.edgeCountValue + 1);
    this.edgeSource[this.edgeCountValue] = source;
    this.edgeTarget[this.edgeCountValue] = target;
    this.edgeWeight[this.edgeCountValue] = weight;

    this.mass[source] += 0.05;
    this.mass[target] += 0.05;

    this.edgeCountValue += 1;
    return this.edgeCountValue - 1;
  }

  public getNodePosition(id: T): { x: number; y: number } | null {
    const index = this.idToIndex.get(id);
    if (index === undefined) {
      return null;
    }

    return { x: this.x[index], y: this.y[index] };
  }

  public getAdaptiveDrawOptions(
    width: number,
    height: number,
    frameTimeMs: number,
    baseNodes = 200_000,
    baseEdges = 150_000
  ): AdaptiveDrawOptions {
    const areaScale = clamp((width * height) / (1920 * 1080), 0.4, 2);
    const target = Math.max(8, this.options.adaptiveTargetFrameMs);
    const qualityScale = clamp(target / Math.max(1, frameTimeMs), 0.35, 1.6) * areaScale;

    return {
      maxDrawNodes: Math.max(500, Math.floor(baseNodes * qualityScale)),
      maxDrawEdges: Math.max(500, Math.floor(baseEdges * qualityScale)),
      qualityScale,
    };
  }

  public step(iterations = 1): StepSummary {
    const count = this.nodeCountValue;
    if (count === 0) {
      return { iterationCount: 0, totalSpeed: 0, averageSpeed: 0, activeNodeCount: 0, theta: this.currentTheta };
    }

    let totalSpeed = 0;
    let activeNodeCount = count;
    const dt = this.options.timeStep;
    const maxSpeedSq = this.options.maxSpeed * this.options.maxSpeed;

    this.prepareNodeIndexList();

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const tickStart = performance.now();
      this.iteration += 1;
      activeNodeCount = this.updateActiveSet();

      this.tree.build(this.nodeIndexes);

      for (let i = 0; i < count; i += 1) {
        if (this.activeMask[i] === 0) {
          continue;
        }
        this.ax[i] = 0;
        this.ay[i] = 0;
      }

      this.applyEdgeAttraction();
      this.applyRepulsion();
      this.applyGravity();

      totalSpeed = 0;
      for (let i = 0; i < count; i += 1) {
        if (this.activeMask[i] === 0) {
          this.vx[i] *= this.options.inactiveVelocityDamping;
          this.vy[i] *= this.options.inactiveVelocityDamping;
          if (this.options.coldNodeUpdateInterval > 0 && this.iteration % this.options.coldNodeUpdateInterval === 0) {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
          }
          totalSpeed += Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
          continue;
        }

        this.vx[i] = (this.vx[i] + this.ax[i] * dt) * this.options.damping;
        this.vy[i] = (this.vy[i] + this.ay[i] * dt) * this.options.damping;

        let speedSq = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
        if (speedSq > maxSpeedSq) {
          const ratio = this.options.maxSpeed / Math.sqrt(speedSq);
          this.vx[i] *= ratio;
          this.vy[i] *= ratio;
          speedSq = maxSpeedSq;
        }

        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        totalSpeed += Math.sqrt(speedSq);
      }

      if (this.options.adaptiveThetaEnabled) {
        const elapsed = performance.now() - tickStart;
        const target = this.options.adaptiveTargetFrameMs;
        if (elapsed > target * 1.05) {
          this.currentTheta = clamp(this.currentTheta + 0.03, this.options.adaptiveThetaMin, this.options.adaptiveThetaMax);
        } else if (elapsed < target * 0.8) {
          this.currentTheta = clamp(this.currentTheta - 0.02, this.options.adaptiveThetaMin, this.options.adaptiveThetaMax);
        }
      }
    }

    return {
      iterationCount: iterations,
      totalSpeed,
      averageSpeed: totalSpeed / count,
      activeNodeCount,
      theta: this.currentTheta,
    };
  }

  public draw(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
    const count = this.nodeCountValue;
    if (count === 0) {
      return;
    }

    const width = options.width;
    const height = options.height;
    const scale = options.scale ?? 1;
    const offsetX = options.offsetX ?? 0;
    const offsetY = options.offsetY ?? 0;
    const nodeRadius = clamp(options.nodeRadius ?? 2, 0.5, 20);
    const maxDrawNodes = Math.max(1, options.maxDrawNodes ?? 200_000);
    const maxDrawEdges = Math.max(1, options.maxDrawEdges ?? 150_000);

    if (options.backgroundColor) {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    if (options.drawEdges !== false && this.edgeCountValue > 0) {
      ctx.strokeStyle = options.edgeColor ?? "#888";
      ctx.lineWidth = options.edgeWidth ?? 0.5;
      ctx.beginPath();

      const edgeStride = Math.max(1, Math.floor(this.edgeCountValue / maxDrawEdges));
      for (let i = 0; i < this.edgeCountValue; i += edgeStride) {
        const source = this.edgeSource[i];
        const target = this.edgeTarget[i];

        const x1 = (this.x[source] + offsetX) * scale;
        const y1 = (this.y[source] + offsetY) * scale;
        const x2 = (this.x[target] + offsetX) * scale;
        const y2 = (this.y[target] + offsetY) * scale;

        if (!this.lineIntersectsViewport(x1, y1, x2, y2, width, height)) {
          continue;
        }

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }

    ctx.fillStyle = options.nodeColor ?? "#1f2937";

    const nodeStride = Math.max(1, Math.floor(count / maxDrawNodes));
    if (nodeRadius <= 1.2) {
      for (let i = 0; i < count; i += nodeStride) {
        const px = (this.x[i] + offsetX) * scale;
        const py = (this.y[i] + offsetY) * scale;
        if (px < 0 || px > width || py < 0 || py > height) {
          continue;
        }
        ctx.fillRect(px, py, 1, 1);
      }
      return;
    }

    ctx.beginPath();
    for (let i = 0; i < count; i += nodeStride) {
      const px = (this.x[i] + offsetX) * scale;
      const py = (this.y[i] + offsetY) * scale;
      if (px < -nodeRadius || px > width + nodeRadius || py < -nodeRadius || py > height + nodeRadius) {
        continue;
      }
      ctx.moveTo(px + nodeRadius, py);
      ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  public exportRenderSnapshot(maxNodes = this.nodeCountValue, maxEdges = this.edgeCountValue): RenderSnapshot {
    const nodeStride = Math.max(1, Math.floor(this.nodeCountValue / Math.max(1, maxNodes)));
    const edgeStride = Math.max(1, Math.floor(this.edgeCountValue / Math.max(1, maxEdges)));

    const nodeCount = Math.ceil(this.nodeCountValue / nodeStride);
    const edgeCount = Math.ceil(this.edgeCountValue / edgeStride);

    const positions = new Float32Array(nodeCount * 2);
    const remap = new Int32Array(this.nodeCountValue);
    remap.fill(-1);

    let mappedNode = 0;
    for (let i = 0; i < this.nodeCountValue; i += nodeStride) {
      remap[i] = mappedNode;
      positions[mappedNode * 2] = this.x[i];
      positions[mappedNode * 2 + 1] = this.y[i];
      mappedNode += 1;
    }

    const edgeSource = new Uint32Array(edgeCount);
    const edgeTarget = new Uint32Array(edgeCount);
    let mappedEdge = 0;

    for (let i = 0; i < this.edgeCountValue; i += edgeStride) {
      const src = this.edgeSource[i];
      const dst = this.edgeTarget[i];
      const remappedSrc = remap[src];
      const remappedDst = remap[dst];
      if (remappedSrc < 0 || remappedDst < 0) {
        continue;
      }
      edgeSource[mappedEdge] = remappedSrc;
      edgeTarget[mappedEdge] = remappedDst;
      mappedEdge += 1;
    }

    return {
      nodeCount,
      edgeCount: mappedEdge,
      positions,
      edgeSource: edgeSource.subarray(0, mappedEdge),
      edgeTarget: edgeTarget.subarray(0, mappedEdge),
    };
  }

  public nodeAt(index: number): { id: T; x: number; y: number; mass: number } | null {
    if (index < 0 || index >= this.nodeCountValue) {
      return null;
    }

    return {
      id: this.ids[index],
      x: this.x[index],
      y: this.y[index],
      mass: this.mass[index],
    };
  }

  public getX(index: number): number {
    return this.x[index];
  }

  public getY(index: number): number {
    return this.y[index];
  }

  public getMass(index: number): number {
    return this.mass[index];
  }

  private updateActiveSet(): number {
    const count = this.nodeCountValue;
    if (!this.options.activeSetEnabled || this.options.coldNodeUpdateInterval <= 1) {
      for (let i = 0; i < count; i += 1) {
        this.activeMask[i] = 1;
      }
      return count;
    }

    const thresholdSq = this.options.sleepVelocityThreshold * this.options.sleepVelocityThreshold;
    const periodicWake = this.options.coldNodeUpdateInterval;
    let active = 0;

    for (let i = 0; i < count; i += 1) {
      const speedSq = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
      const periodic = ((i + this.iteration) % periodicWake) === 0;
      const isActive = speedSq >= thresholdSq || periodic;
      this.activeMask[i] = isActive ? 1 : 0;
      if (isActive) {
        active += 1;
      }
    }

    return active;
  }

  private applyEdgeAttraction(): void {
    if (this.wasmKernel && this.wasmKernel.isReady()) {
      this.wasmKernel.applyEdgeAttraction(
        this.x,
        this.y,
        this.mass,
        this.ax,
        this.ay,
        this.edgeSource,
        this.edgeTarget,
        this.edgeWeight,
        this.edgeCountValue,
        this.options.springLength,
        this.options.springStrength,
        this.options.minDistance,
        this.activeMask
      );
      return;
    }

    const springLength = this.options.springLength;
    const springStrength = this.options.springStrength;
    const minDistance = this.options.minDistance;

    for (let i = 0; i < this.edgeCountValue; i += 1) {
      const source = this.edgeSource[i];
      const target = this.edgeTarget[i];

      if (this.activeMask[source] === 0 && this.activeMask[target] === 0) {
        continue;
      }

      const dx = this.x[target] - this.x[source];
      const dy = this.y[target] - this.y[source];
      const distSq = dx * dx + dy * dy + minDistance * minDistance;
      const dist = Math.sqrt(distSq);
      const weight = this.edgeWeight[i] || 1;
      const force = springStrength * weight * (dist - springLength);
      const ux = dx / dist;
      const uy = dy / dist;
      const fx = force * ux;
      const fy = force * uy;

      if (this.activeMask[source] !== 0) {
        this.ax[source] += fx / this.mass[source];
        this.ay[source] += fy / this.mass[source];
      }

      if (this.activeMask[target] !== 0) {
        this.ax[target] -= fx / this.mass[target];
        this.ay[target] -= fy / this.mass[target];
      }
    }
  }

  private applyRepulsion(): void {
    const repulsionStrength = this.options.repulsionStrength;

    for (let i = 0; i < this.nodeCountValue; i += 1) {
      if (this.activeMask[i] === 0) {
        continue;
      }
      const [fx, fy] = this.tree.computeRepulsion(i, repulsionStrength, this.currentTheta);
      this.ax[i] += fx / this.mass[i];
      this.ay[i] += fy / this.mass[i];
    }
  }

  private applyGravity(): void {
    const gravity = this.options.gravity;
    if (gravity <= 0) {
      return;
    }

    for (let i = 0; i < this.nodeCountValue; i += 1) {
      if (this.activeMask[i] === 0) {
        continue;
      }
      this.ax[i] += -this.x[i] * gravity;
      this.ay[i] += -this.y[i] * gravity;
    }
  }

  private ensureNodeCapacity(required: number): void {
    if (required <= this.nodeCapacity) {
      return;
    }

    let nextCapacity = Math.max(16, this.nodeCapacity * 2);
    while (nextCapacity < required) {
      nextCapacity *= 2;
    }

    this.x = this.growFloatArray(this.x, nextCapacity);
    this.y = this.growFloatArray(this.y, nextCapacity);
    this.vx = this.growFloatArray(this.vx, nextCapacity);
    this.vy = this.growFloatArray(this.vy, nextCapacity);
    this.ax = this.growFloatArray(this.ax, nextCapacity);
    this.ay = this.growFloatArray(this.ay, nextCapacity);
    this.mass = this.growFloatArray(this.mass, nextCapacity);
    this.activeMask = this.growUint8Array(this.activeMask, nextCapacity);
    this.nodeCapacity = nextCapacity;
  }

  private ensureEdgeCapacity(required: number): void {
    if (required <= this.edgeCapacity) {
      return;
    }

    let nextCapacity = Math.max(16, this.edgeCapacity * 2);
    while (nextCapacity < required) {
      nextCapacity *= 2;
    }

    this.edgeSource = this.growUint32Array(this.edgeSource, nextCapacity);
    this.edgeTarget = this.growUint32Array(this.edgeTarget, nextCapacity);
    this.edgeWeight = this.growFloat32Array(this.edgeWeight, nextCapacity);
    this.edgeCapacity = nextCapacity;
  }

  private growFloatArray(source: Float64Array<ArrayBufferLike>, size: number): Float64Array<ArrayBufferLike> {
    const next = new Float64Array(size);
    next.set(source);
    return next;
  }

  private growFloat32Array(source: Float32Array<ArrayBufferLike>, size: number): Float32Array<ArrayBufferLike> {
    const next = new Float32Array(size);
    next.set(source);
    return next;
  }

  private growUint32Array(source: Uint32Array<ArrayBufferLike>, size: number): Uint32Array<ArrayBufferLike> {
    const next = new Uint32Array(size);
    next.set(source);
    return next;
  }

  private growUint8Array(source: Uint8Array<ArrayBufferLike>, size: number): Uint8Array<ArrayBufferLike> {
    const next = new Uint8Array(size);
    next.set(source);
    return next;
  }

  private prepareNodeIndexList(): void {
    if (this.nodeIndexes.length !== this.nodeCountValue) {
      this.nodeIndexes = Array.from({ length: this.nodeCountValue }, (_, idx) => idx);
    }
  }

  private lineIntersectsViewport(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    height: number
  ): boolean {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    return !(maxX < 0 || maxY < 0 || minX > width || minY > height);
  }
}

export { DEFAULT_SIMULATION_OPTIONS };
