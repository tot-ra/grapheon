import { BarnesHutTree } from "./quadtree.js";
const DEFAULT_SIMULATION_OPTIONS = {
    springLength: 24,
    springStrength: 0.08,
    repulsionStrength: 180,
    gravity: 0.003,
    gravityMode: "center",
    gravityCenterX: 0,
    gravityCenterY: 0,
    gravityCenterZ: 0,
    gravityDirectionX: 0,
    gravityDirectionY: 1,
    gravityDirectionZ: 0,
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
function clamp(value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
function colorToBytes(value, fallback) {
    const input = value ?? fallback;
    if (input.startsWith("#") && (input.length === 7 || input.length === 9)) {
        return [
            parseInt(input.slice(1, 3), 16),
            parseInt(input.slice(3, 5), 16),
            parseInt(input.slice(5, 7), 16),
            input.length === 9 ? parseInt(input.slice(7, 9), 16) : 255,
        ];
    }
    return colorToBytes(fallback, "#000000");
}
function rotatePoint(x, y, z, options) {
    const rx = options.rotationX ?? -0.45;
    const ry = options.rotationY ?? 0.55;
    const rz = options.rotationZ ?? 0;
    let px = x;
    let py = y;
    let pz = z;
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const y1 = py * cosX - pz * sinX;
    const z1 = py * sinX + pz * cosX;
    py = y1;
    pz = z1;
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x2 = px * cosY + pz * sinY;
    const z2 = -px * sinY + pz * cosY;
    px = x2;
    pz = z2;
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    const x3 = px * cosZ - py * sinZ;
    const y3 = px * sinZ + py * cosZ;
    return { x: x3, y: y3, z: pz };
}
function projectPoint(x, y, z, options) {
    if (options.renderDimension === "2d") {
        return { x, y, depthScale: 1 };
    }
    const rotated = rotatePoint(x, y, z, options);
    if (options.projection === "orthographic") {
        return { x: rotated.x, y: rotated.y, depthScale: 1 };
    }
    const cameraDistance = Math.max(1, options.cameraDistance ?? 1200);
    const denominator = Math.max(1, cameraDistance + rotated.z);
    const depthScale = cameraDistance / denominator;
    return {
        x: rotated.x * depthScale,
        y: rotated.y * depthScale,
        depthScale,
    };
}
function drawNodeShape(ctx, shape, x, y, radius) {
    switch (shape) {
        case "square":
            ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
            break;
        case "diamond":
            ctx.moveTo(x, y - radius);
            ctx.lineTo(x + radius, y);
            ctx.lineTo(x, y + radius);
            ctx.lineTo(x - radius, y);
            ctx.closePath();
            break;
        case "triangle":
            ctx.moveTo(x, y - radius);
            ctx.lineTo(x + radius * 0.9, y + radius * 0.8);
            ctx.lineTo(x - radius * 0.9, y + radius * 0.8);
            ctx.closePath();
            break;
        default:
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            break;
    }
}
export class ForceGraph {
    constructor(options = {}) {
        this.idToIndex = new Map();
        this.ids = [];
        this.nodeCapacity = 0;
        this.nodeCountValue = 0;
        this.x = new Float64Array(0);
        this.y = new Float64Array(0);
        this.z = new Float64Array(0);
        this.vx = new Float64Array(0);
        this.vy = new Float64Array(0);
        this.vz = new Float64Array(0);
        this.ax = new Float64Array(0);
        this.ay = new Float64Array(0);
        this.az = new Float64Array(0);
        this.mass = new Float64Array(0);
        this.nodeRadii = new Float32Array(0);
        this.nodeColors = [];
        this.activeMask = new Uint8Array(0);
        this.edgeCapacity = 0;
        this.edgeCountValue = 0;
        this.edgeSource = new Uint32Array(0);
        this.edgeTarget = new Uint32Array(0);
        this.edgeWeight = new Float32Array(0);
        this.edgeWidths = new Float32Array(0);
        this.edgeColors = [];
        this.nodeIndexes = [];
        this.iteration = 0;
        this.wasmKernel = null;
        this.hasNodeAppearanceOverrides = false;
        this.hasEdgeAppearanceOverrides = false;
        this.options = { ...DEFAULT_SIMULATION_OPTIONS, ...options };
        this.currentTheta = this.options.theta;
        this.tree = new BarnesHutTree(this, this.options.minDistance);
    }
    get nodeCount() {
        return this.nodeCountValue;
    }
    get edgeCount() {
        return this.edgeCountValue;
    }
    setWasmKernel(kernel) {
        this.wasmKernel = kernel;
    }
    addNode(id, input = {}) {
        const existing = this.idToIndex.get(id);
        if (existing !== undefined) {
            if (input.x !== undefined)
                this.x[existing] = input.x;
            if (input.y !== undefined)
                this.y[existing] = input.y;
            if (input.z !== undefined)
                this.z[existing] = input.z;
            if (input.mass !== undefined)
                this.mass[existing] = Math.max(0.01, input.mass);
            if (input.appearance)
                this.applyNodeAppearance(existing, input.appearance);
            return existing;
        }
        const index = this.nodeCountValue;
        this.ensureNodeCapacity(index + 1);
        const spread = this.options.initialSpread;
        this.x[index] = input.x ?? (Math.random() * 2 - 1) * spread;
        this.y[index] = input.y ?? (Math.random() * 2 - 1) * spread;
        this.z[index] = input.z ?? (Math.random() * 2 - 1) * spread;
        this.vx[index] = 0;
        this.vy[index] = 0;
        this.vz[index] = 0;
        this.ax[index] = 0;
        this.ay[index] = 0;
        this.az[index] = 0;
        this.mass[index] = Math.max(0.01, input.mass ?? 1);
        this.nodeRadii[index] = input.appearance?.radius ?? 0;
        this.nodeColors[index] = input.appearance?.color;
        this.activeMask[index] = 1;
        this.hasNodeAppearanceOverrides ||= Boolean(input.appearance?.color || input.appearance?.radius !== undefined);
        this.ids.push(id);
        this.idToIndex.set(id, index);
        this.nodeCountValue += 1;
        return index;
    }
    addEdge(sourceId, targetId, weightOrInput = 1) {
        const source = this.addNode(sourceId);
        const target = this.addNode(targetId);
        const edgeInput = typeof weightOrInput === "number" ? { weight: weightOrInput } : weightOrInput;
        this.ensureEdgeCapacity(this.edgeCountValue + 1);
        this.edgeSource[this.edgeCountValue] = source;
        this.edgeTarget[this.edgeCountValue] = target;
        this.edgeWeight[this.edgeCountValue] = edgeInput.weight ?? 1;
        this.edgeWidths[this.edgeCountValue] = edgeInput.appearance?.width ?? 0;
        this.edgeColors[this.edgeCountValue] = edgeInput.appearance?.color;
        this.hasEdgeAppearanceOverrides ||= Boolean(edgeInput.appearance?.color || edgeInput.appearance?.width !== undefined);
        this.mass[source] += 0.05;
        this.mass[target] += 0.05;
        this.edgeCountValue += 1;
        return this.edgeCountValue - 1;
    }
    setNodeAppearance(id, appearance) {
        const index = this.idToIndex.get(id);
        if (index === undefined) {
            throw new Error(`Unknown node id: ${String(id)}`);
        }
        this.applyNodeAppearance(index, appearance);
    }
    setEdgeAppearance(index, appearance) {
        if (index < 0 || index >= this.edgeCountValue) {
            throw new Error(`Unknown edge index: ${index}`);
        }
        if (appearance.color !== undefined) {
            this.edgeColors[index] = appearance.color;
        }
        if (appearance.width !== undefined) {
            this.edgeWidths[index] = appearance.width;
        }
        this.hasEdgeAppearanceOverrides = true;
    }
    getNodePosition(id) {
        const index = this.idToIndex.get(id);
        if (index === undefined) {
            return null;
        }
        return { x: this.x[index], y: this.y[index], z: this.z[index] };
    }
    getAdaptiveDrawOptions(width, height, frameTimeMs, baseNodes = 200_000, baseEdges = 150_000) {
        const areaScale = clamp((width * height) / (1920 * 1080), 0.4, 2);
        const target = Math.max(8, this.options.adaptiveTargetFrameMs);
        const qualityScale = clamp(target / Math.max(1, frameTimeMs), 0.35, 1.6) * areaScale;
        return {
            maxDrawNodes: Math.max(500, Math.floor(baseNodes * qualityScale)),
            maxDrawEdges: Math.max(500, Math.floor(baseEdges * qualityScale)),
            qualityScale,
        };
    }
    step(iterations = 1) {
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
                this.az[i] = 0;
            }
            this.applyEdgeAttraction();
            this.applyRepulsion();
            this.applyGravity();
            totalSpeed = 0;
            for (let i = 0; i < count; i += 1) {
                if (this.activeMask[i] === 0) {
                    this.vx[i] *= this.options.inactiveVelocityDamping;
                    this.vy[i] *= this.options.inactiveVelocityDamping;
                    this.vz[i] *= this.options.inactiveVelocityDamping;
                    if (this.options.coldNodeUpdateInterval > 0 && this.iteration % this.options.coldNodeUpdateInterval === 0) {
                        this.x[i] += this.vx[i] * dt;
                        this.y[i] += this.vy[i] * dt;
                        this.z[i] += this.vz[i] * dt;
                    }
                    totalSpeed += Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i]);
                    continue;
                }
                this.vx[i] = (this.vx[i] + this.ax[i] * dt) * this.options.damping;
                this.vy[i] = (this.vy[i] + this.ay[i] * dt) * this.options.damping;
                this.vz[i] = (this.vz[i] + this.az[i] * dt) * this.options.damping;
                let speedSq = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i];
                if (speedSq > maxSpeedSq) {
                    const ratio = this.options.maxSpeed / Math.sqrt(speedSq);
                    this.vx[i] *= ratio;
                    this.vy[i] *= ratio;
                    this.vz[i] *= ratio;
                    speedSq = maxSpeedSq;
                }
                this.x[i] += this.vx[i] * dt;
                this.y[i] += this.vy[i] * dt;
                this.z[i] += this.vz[i] * dt;
                totalSpeed += Math.sqrt(speedSq);
            }
            if (this.options.adaptiveThetaEnabled) {
                const elapsed = performance.now() - tickStart;
                const target = this.options.adaptiveTargetFrameMs;
                if (elapsed > target * 1.05) {
                    this.currentTheta = clamp(this.currentTheta + 0.03, this.options.adaptiveThetaMin, this.options.adaptiveThetaMax);
                }
                else if (elapsed < target * 0.8) {
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
    draw(ctx, options) {
        const count = this.nodeCountValue;
        if (count === 0) {
            return;
        }
        const width = options.width;
        const height = options.height;
        const scale = options.scale ?? 1;
        const offsetX = options.offsetX ?? 0;
        const offsetY = options.offsetY ?? 0;
        const nodeRadiusFallback = clamp(options.nodeRadius ?? 2, 0.5, 20);
        const maxDrawNodes = Math.max(1, options.maxDrawNodes ?? 200_000);
        const maxDrawEdges = Math.max(1, options.maxDrawEdges ?? 150_000);
        if (options.backgroundColor) {
            ctx.fillStyle = options.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }
        else {
            ctx.clearRect(0, 0, width, height);
        }
        if (options.drawEdges !== false && this.edgeCountValue > 0) {
            const edgeStride = Math.max(1, Math.floor(this.edgeCountValue / maxDrawEdges));
            for (let i = 0; i < this.edgeCountValue; i += edgeStride) {
                const source = this.edgeSource[i];
                const target = this.edgeTarget[i];
                const p1 = projectPoint(this.x[source], this.y[source], this.z[source], options);
                const p2 = projectPoint(this.x[target], this.y[target], this.z[target], options);
                const x1 = (p1.x + offsetX) * scale;
                const y1 = (p1.y + offsetY) * scale;
                const x2 = (p2.x + offsetX) * scale;
                const y2 = (p2.y + offsetY) * scale;
                if (!this.lineIntersectsViewport(x1, y1, x2, y2, width, height)) {
                    continue;
                }
                ctx.beginPath();
                ctx.strokeStyle = this.edgeColors[i] ?? options.edgeColor ?? "#888";
                ctx.lineWidth = this.edgeWidths[i] > 0 ? this.edgeWidths[i] : (options.edgeWidth ?? 0.5);
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
        const nodeStride = Math.max(1, Math.floor(count / maxDrawNodes));
        for (let i = 0; i < count; i += nodeStride) {
            const projected = projectPoint(this.x[i], this.y[i], this.z[i], options);
            const px = (projected.x + offsetX) * scale;
            const py = (projected.y + offsetY) * scale;
            const radius = (this.nodeRadii[i] > 0 ? this.nodeRadii[i] : nodeRadiusFallback) * projected.depthScale;
            if (px < -radius || px > width + radius || py < -radius || py > height + radius) {
                continue;
            }
            ctx.fillStyle = this.nodeColors[i] ?? options.nodeColor ?? "#1f2937";
            if (radius <= 1.2) {
                ctx.fillRect(px, py, 1, 1);
                continue;
            }
            ctx.beginPath();
            drawNodeShape(ctx, options.nodeShape, px, py, radius);
            ctx.fill();
        }
    }
    exportRenderSnapshot(maxNodes = this.nodeCountValue, maxEdges = this.edgeCountValue) {
        const nodeStride = Math.max(1, Math.floor(this.nodeCountValue / Math.max(1, maxNodes)));
        const edgeStride = Math.max(1, Math.floor(this.edgeCountValue / Math.max(1, maxEdges)));
        const nodeCount = Math.ceil(this.nodeCountValue / nodeStride);
        const edgeCount = Math.ceil(this.edgeCountValue / edgeStride);
        const positions = new Float32Array(nodeCount * 3);
        const nodeRadii = new Float32Array(nodeCount);
        const nodeColors = new Uint8Array(nodeCount * 4);
        const remap = new Int32Array(this.nodeCountValue);
        remap.fill(-1);
        let mappedNode = 0;
        for (let i = 0; i < this.nodeCountValue; i += nodeStride) {
            remap[i] = mappedNode;
            positions[mappedNode * 3] = this.x[i];
            positions[mappedNode * 3 + 1] = this.y[i];
            positions[mappedNode * 3 + 2] = this.z[i];
            nodeRadii[mappedNode] = this.nodeRadii[i];
            nodeColors.set(colorToBytes(this.nodeColors[i], "#00000000"), mappedNode * 4);
            mappedNode += 1;
        }
        const edgeSource = new Uint32Array(edgeCount);
        const edgeTarget = new Uint32Array(edgeCount);
        const edgeWidths = new Float32Array(edgeCount);
        const edgeColors = new Uint8Array(edgeCount * 4);
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
            edgeWidths[mappedEdge] = this.edgeWidths[i];
            edgeColors.set(colorToBytes(this.edgeColors[i], "#00000000"), mappedEdge * 4);
            mappedEdge += 1;
        }
        return {
            nodeCount,
            edgeCount: mappedEdge,
            positions,
            edgeSource: edgeSource.subarray(0, mappedEdge),
            edgeTarget: edgeTarget.subarray(0, mappedEdge),
            nodeRadii,
            nodeColors,
            edgeWidths: edgeWidths.subarray(0, mappedEdge),
            edgeColors: edgeColors.subarray(0, mappedEdge * 4),
        };
    }
    nodeAt(index) {
        if (index < 0 || index >= this.nodeCountValue) {
            return null;
        }
        return {
            id: this.ids[index],
            x: this.x[index],
            y: this.y[index],
            z: this.z[index],
            mass: this.mass[index],
        };
    }
    getX(index) {
        return this.x[index];
    }
    getY(index) {
        return this.y[index];
    }
    getZ(index) {
        return this.z[index];
    }
    getMass(index) {
        return this.mass[index];
    }
    updateActiveSet() {
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
            const speedSq = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i];
            const periodic = ((i + this.iteration) % periodicWake) === 0;
            const isActive = speedSq >= thresholdSq || periodic;
            this.activeMask[i] = isActive ? 1 : 0;
            if (isActive) {
                active += 1;
            }
        }
        return active;
    }
    applyEdgeAttraction() {
        if (this.wasmKernel && this.wasmKernel.isReady()) {
            this.wasmKernel.applyEdgeAttraction(this.x, this.y, this.mass, this.ax, this.ay, this.edgeSource, this.edgeTarget, this.edgeWeight, this.edgeCountValue, this.options.springLength, this.options.springStrength, this.options.minDistance, this.activeMask);
            this.applyEdgeAttractionZOnly();
        }
        else {
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
                const dz = this.z[target] - this.z[source];
                const distSq = dx * dx + dy * dy + dz * dz + minDistance * minDistance;
                const dist = Math.sqrt(distSq);
                const weight = this.edgeWeight[i] || 1;
                const force = springStrength * weight * (dist - springLength);
                const ux = dx / dist;
                const uy = dy / dist;
                const uz = dz / dist;
                const fx = force * ux;
                const fy = force * uy;
                const fz = force * uz;
                if (this.activeMask[source] !== 0) {
                    this.ax[source] += fx / this.mass[source];
                    this.ay[source] += fy / this.mass[source];
                    this.az[source] += fz / this.mass[source];
                }
                if (this.activeMask[target] !== 0) {
                    this.ax[target] -= fx / this.mass[target];
                    this.ay[target] -= fy / this.mass[target];
                    this.az[target] -= fz / this.mass[target];
                }
            }
        }
    }
    applyEdgeAttractionZOnly() {
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
            const dz = this.z[target] - this.z[source];
            const distSq = dx * dx + dy * dy + dz * dz + minDistance * minDistance;
            const dist = Math.sqrt(distSq);
            const weight = this.edgeWeight[i] || 1;
            const force = springStrength * weight * (dist - springLength);
            const fz = force * (dz / dist);
            if (this.activeMask[source] !== 0) {
                this.az[source] += fz / this.mass[source];
            }
            if (this.activeMask[target] !== 0) {
                this.az[target] -= fz / this.mass[target];
            }
        }
    }
    applyRepulsion() {
        const repulsionStrength = this.options.repulsionStrength;
        for (let i = 0; i < this.nodeCountValue; i += 1) {
            if (this.activeMask[i] === 0) {
                continue;
            }
            const [fx, fy, fz] = this.tree.computeRepulsion(i, repulsionStrength, this.currentTheta);
            this.ax[i] += fx / this.mass[i];
            this.ay[i] += fy / this.mass[i];
            this.az[i] += fz / this.mass[i];
        }
    }
    applyGravity() {
        const gravity = this.options.gravity;
        if (gravity <= 0) {
            return;
        }
        const directionLength = Math.hypot(this.options.gravityDirectionX, this.options.gravityDirectionY, this.options.gravityDirectionZ) || 1;
        const directionX = this.options.gravityDirectionX / directionLength;
        const directionY = this.options.gravityDirectionY / directionLength;
        const directionZ = this.options.gravityDirectionZ / directionLength;
        for (let i = 0; i < this.nodeCountValue; i += 1) {
            if (this.activeMask[i] === 0) {
                continue;
            }
            if (this.options.gravityMode === "center" || this.options.gravityMode === "both") {
                this.ax[i] += (this.options.gravityCenterX - this.x[i]) * gravity;
                this.ay[i] += (this.options.gravityCenterY - this.y[i]) * gravity;
                this.az[i] += (this.options.gravityCenterZ - this.z[i]) * gravity;
            }
            if (this.options.gravityMode === "directional" || this.options.gravityMode === "both") {
                this.ax[i] += directionX * gravity;
                this.ay[i] += directionY * gravity;
                this.az[i] += directionZ * gravity;
            }
        }
    }
    applyNodeAppearance(index, appearance) {
        if (appearance.color !== undefined) {
            this.nodeColors[index] = appearance.color;
        }
        if (appearance.radius !== undefined) {
            this.nodeRadii[index] = appearance.radius;
        }
        this.hasNodeAppearanceOverrides = true;
    }
    ensureNodeCapacity(required) {
        if (required <= this.nodeCapacity) {
            return;
        }
        let nextCapacity = Math.max(16, this.nodeCapacity * 2);
        while (nextCapacity < required) {
            nextCapacity *= 2;
        }
        this.x = this.growFloatArray(this.x, nextCapacity);
        this.y = this.growFloatArray(this.y, nextCapacity);
        this.z = this.growFloatArray(this.z, nextCapacity);
        this.vx = this.growFloatArray(this.vx, nextCapacity);
        this.vy = this.growFloatArray(this.vy, nextCapacity);
        this.vz = this.growFloatArray(this.vz, nextCapacity);
        this.ax = this.growFloatArray(this.ax, nextCapacity);
        this.ay = this.growFloatArray(this.ay, nextCapacity);
        this.az = this.growFloatArray(this.az, nextCapacity);
        this.mass = this.growFloatArray(this.mass, nextCapacity);
        this.nodeRadii = this.growFloat32Array(this.nodeRadii, nextCapacity);
        this.activeMask = this.growUint8Array(this.activeMask, nextCapacity);
        this.nodeColors.length = nextCapacity;
        this.nodeCapacity = nextCapacity;
    }
    ensureEdgeCapacity(required) {
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
        this.edgeWidths = this.growFloat32Array(this.edgeWidths, nextCapacity);
        this.edgeColors.length = nextCapacity;
        this.edgeCapacity = nextCapacity;
    }
    growFloatArray(source, size) {
        const next = new Float64Array(size);
        next.set(source);
        return next;
    }
    growFloat32Array(source, size) {
        const next = new Float32Array(size);
        next.set(source);
        return next;
    }
    growUint32Array(source, size) {
        const next = new Uint32Array(size);
        next.set(source);
        return next;
    }
    growUint8Array(source, size) {
        const next = new Uint8Array(size);
        next.set(source);
        return next;
    }
    prepareNodeIndexList() {
        if (this.nodeIndexes.length !== this.nodeCountValue) {
            this.nodeIndexes = Array.from({ length: this.nodeCountValue }, (_, idx) => idx);
        }
    }
    lineIntersectsViewport(x1, y1, x2, y2, width, height) {
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);
        return !(maxX < 0 || maxY < 0 || minX > width || minY > height);
    }
}
export { DEFAULT_SIMULATION_OPTIONS, projectPoint };
