export class JsEdgeAttractionKernel {
    isReady() {
        return true;
    }
    applyEdgeAttraction(x, y, mass, ax, ay, edgeSource, edgeTarget, edgeWeight, edgeCount, springLength, springStrength, minDistance, activeMask) {
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
export class ExternalWasmEdgeKernel {
    constructor(delegate) {
        this.delegate = delegate;
        this.ready = false;
        this.ready = delegate.isReady();
    }
    isReady() {
        return this.ready;
    }
    applyEdgeAttraction(x, y, mass, ax, ay, edgeSource, edgeTarget, edgeWeight, edgeCount, springLength, springStrength, minDistance, activeMask) {
        this.delegate.applyEdgeAttraction(x, y, mass, ax, ay, edgeSource, edgeTarget, edgeWeight, edgeCount, springLength, springStrength, minDistance, activeMask);
    }
}
export function createBestAvailableKernel(externalWasmKernel) {
    if (externalWasmKernel && externalWasmKernel.isReady()) {
        return new ExternalWasmEdgeKernel(externalWasmKernel);
    }
    return new JsEdgeAttractionKernel();
}
