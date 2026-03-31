import type { RenderSnapshot, SimulationOptions, StepSummary } from "./types.js";

type RequestMessage =
  | { type: "init"; options: Partial<SimulationOptions> }
  | { type: "load"; nodeCount: number; positions?: Float32Array; edges: Uint32Array }
  | { type: "step"; iterations: number }
  | { type: "snapshot"; maxNodes: number; maxEdges: number };

type ResponseMessage =
  | { type: "inited" }
  | { type: "loaded"; nodeCount: number; edgeCount: number }
  | { type: "step"; summary: StepSummary }
  | { type: "snapshot"; snapshot: RenderSnapshot }
  | { type: "error"; message: string };

interface Pending {
  resolve: (value: ResponseMessage) => void;
  reject: (error: Error) => void;
}

export class ForceGraphWorkerClient {
  private readonly worker: Worker;
  private requestId = 0;
  private readonly pending = new Map<number, Pending>();

  public constructor(workerUrl = new URL("./forceGraph.worker.js", import.meta.url), options?: WorkerOptions) {
    this.worker = new Worker(workerUrl, { type: "module", ...(options ?? {}) });
    this.worker.onmessage = (event: MessageEvent<{ id: number; payload: ResponseMessage }>) => {
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

  public terminate(): void {
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
  }

  public async init(options: Partial<SimulationOptions> = {}): Promise<void> {
    await this.send({ type: "init", options });
  }

  public async loadGraph(nodeCount: number, edges: Uint32Array, positions?: Float32Array): Promise<{ nodeCount: number; edgeCount: number }> {
    const transferables: Transferable[] = [edges.buffer];
    if (positions) {
      transferables.push(positions.buffer);
    }
    const request: RequestMessage = positions
      ? { type: "load", nodeCount, edges, positions }
      : { type: "load", nodeCount, edges };
    const payload = (await this.send(request, transferables)) as {
      type: "loaded";
      nodeCount: number;
      edgeCount: number;
    };

    return { nodeCount: payload.nodeCount, edgeCount: payload.edgeCount };
  }

  public async step(iterations = 1): Promise<StepSummary> {
    const payload = (await this.send({ type: "step", iterations })) as { type: "step"; summary: StepSummary };
    return payload.summary;
  }

  public async snapshot(maxNodes = 200_000, maxEdges = 150_000): Promise<RenderSnapshot> {
    const payload = (await this.send({ type: "snapshot", maxNodes, maxEdges })) as {
      type: "snapshot";
      snapshot: RenderSnapshot;
    };
    return payload.snapshot;
  }

  private send(payload: RequestMessage, transferables: Transferable[] = []): Promise<ResponseMessage> {
    const id = this.requestId;
    this.requestId += 1;

    return new Promise<ResponseMessage>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, payload }, transferables);
    });
  }
}
