import { ForceGraph } from "./forceGraph.js";
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

let graph = new ForceGraph<number>();
const workerScope = self as unknown as { postMessage: (message: unknown, transfer?: Transferable[]) => void };

function toTransferables(snapshot: RenderSnapshot): Transferable[] {
  return [snapshot.positions.buffer, snapshot.edgeSource.buffer, snapshot.edgeTarget.buffer];
}

self.onmessage = (event: MessageEvent<{ id: number; payload: RequestMessage }>) => {
  const { id, payload } = event.data;

  try {
    let response: ResponseMessage;
    let transferables: Transferable[] = [];

    switch (payload.type) {
      case "init": {
        graph = new ForceGraph<number>(payload.options);
        response = { type: "inited" };
        break;
      }
      case "load": {
        graph = new ForceGraph<number>();
        const { nodeCount, positions, edges } = payload;

        for (let i = 0; i < nodeCount; i += 1) {
          const x = positions ? positions[i * 2] : undefined;
          const y = positions ? positions[i * 2 + 1] : undefined;
          const nodeInput: { x?: number; y?: number } = {};
          if (x !== undefined) nodeInput.x = x;
          if (y !== undefined) nodeInput.y = y;
          graph.addNode(i, nodeInput);
        }

        for (let i = 0; i + 1 < edges.length; i += 2) {
          graph.addEdge(edges[i], edges[i + 1], 1);
        }

        response = { type: "loaded", nodeCount: graph.nodeCount, edgeCount: graph.edgeCount };
        break;
      }
      case "step": {
        const summary = graph.step(payload.iterations);
        response = { type: "step", summary };
        break;
      }
      case "snapshot": {
        const snapshot = graph.exportRenderSnapshot(payload.maxNodes, payload.maxEdges);
        response = { type: "snapshot", snapshot };
        transferables = toTransferables(snapshot);
        break;
      }
      default:
        response = { type: "error", message: "Unknown message type" };
    }

    workerScope.postMessage({ id, payload: response }, transferables);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failure";
    workerScope.postMessage({ id, payload: { type: "error", message } satisfies ResponseMessage });
  }
};
