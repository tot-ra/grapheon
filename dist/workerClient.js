export class ForceGraphWorkerClient {
    constructor(workerUrl = new URL("./forceGraph.worker.js", import.meta.url), options) {
        this.requestId = 0;
        this.pending = new Map();
        this.worker = new Worker(workerUrl, { type: "module", ...(options ?? {}) });
        this.worker.onmessage = (event) => {
            const { id, payload } = event.data;
            const request = this.pending.get(id);
            if (!request) {
                return;
            }
            this.pending.delete(id);
            if (payload.type === "error") {
                request.reject(new Error(payload.message));
                return;
            }
            request.resolve(payload);
        };
    }
    terminate() {
        this.worker.terminate();
        for (const pending of this.pending.values()) {
            pending.reject(new Error("Worker terminated"));
        }
        this.pending.clear();
    }
    async init(options = {}) {
        await this.send({ type: "init", options });
    }
    async loadGraph(nodeCount, edges, positions) {
        const transferables = [edges.buffer];
        if (positions) {
            transferables.push(positions.buffer);
        }
        const request = positions
            ? { type: "load", nodeCount, edges, positions }
            : { type: "load", nodeCount, edges };
        const payload = (await this.send(request, transferables));
        return { nodeCount: payload.nodeCount, edgeCount: payload.edgeCount };
    }
    async step(iterations = 1) {
        const payload = (await this.send({ type: "step", iterations }));
        return payload.summary;
    }
    async snapshot(maxNodes = 200_000, maxEdges = 150_000) {
        const payload = (await this.send({ type: "snapshot", maxNodes, maxEdges }));
        return payload.snapshot;
    }
    send(payload, transferables = []) {
        const id = this.requestId;
        this.requestId += 1;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ id, payload }, transferables);
        });
    }
}
