import { ForceGraphWorkerClient } from "./workerClient.js";
import type { RenderSnapshot, SimulationOptions, StepSummary } from "./types.js";

interface ShardInfo {
  start: number;
  count: number;
}

interface LoadResult {
  nodeCount: number;
  edgeCount: number;
}

export class ForceGraphWorkerPoolClient {
  private readonly workers: ForceGraphWorkerClient[];
  private shards: ShardInfo[] = [];

  public constructor(workerCount = 30) {
    const count = Math.max(1, workerCount);
    this.workers = Array.from({ length: count }, () => new ForceGraphWorkerClient());
  }

  public get workerCount(): number {
    return this.workers.length;
  }

  public async init(options: Partial<SimulationOptions> = {}): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.init(options)));
  }

  public terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
  }

  public async loadGraph(nodeCount: number, edges: Uint32Array, positions?: Float32Array): Promise<LoadResult> {
    this.shards = this.createShards(nodeCount, this.workers.length);

    const shardEdges = this.partitionEdges(edges, this.shards);
    const jobs = this.shards.map((shard, index) => {
      const localPositions = this.slicePositions(positions, shard.start, shard.count);
      return this.workers[index].loadGraph(shard.count, shardEdges[index], localPositions);
    });

    const results = await Promise.all(jobs);

    return {
      nodeCount: results.reduce((sum, result) => sum + result.nodeCount, 0),
      edgeCount: results.reduce((sum, result) => sum + result.edgeCount, 0),
    };
  }

  public async step(iterations = 1): Promise<StepSummary> {
    const summaries = await Promise.all(this.workers.map((worker) => worker.step(iterations)));

    let totalSpeed = 0;
    let totalActive = 0;
    let thetaSum = 0;

    for (const summary of summaries) {
      totalSpeed += summary.totalSpeed;
      totalActive += summary.activeNodeCount;
      thetaSum += summary.theta;
    }

    return {
      iterationCount: iterations,
      totalSpeed,
      averageSpeed: totalSpeed / Math.max(1, totalActive),
      activeNodeCount: totalActive,
      theta: thetaSum / Math.max(1, summaries.length),
    };
  }

  public async snapshot(maxNodes = 200_000, maxEdges = 150_000): Promise<RenderSnapshot> {
    if (this.shards.length === 0) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        positions: new Float32Array(0),
        edgeSource: new Uint32Array(0),
        edgeTarget: new Uint32Array(0),
      };
    }

    const perWorkerNodes = Math.max(1, Math.floor(maxNodes / this.workers.length));
    const perWorkerEdges = Math.max(1, Math.floor(maxEdges / this.workers.length));
    const snapshots = await Promise.all(this.workers.map((worker) => worker.snapshot(perWorkerNodes, perWorkerEdges)));

    const nodeCount = snapshots.reduce((sum, snapshot) => sum + snapshot.nodeCount, 0);
    const edgeCount = snapshots.reduce((sum, snapshot) => sum + snapshot.edgeCount, 0);

    const positions = new Float32Array(nodeCount * 2);
    const edgeSource = new Uint32Array(edgeCount);
    const edgeTarget = new Uint32Array(edgeCount);

    let nodeOffset = 0;
    let edgeOffset = 0;

    for (let i = 0; i < snapshots.length; i += 1) {
      const snapshot = snapshots[i];
      positions.set(snapshot.positions, nodeOffset * 2);

      for (let e = 0; e < snapshot.edgeCount; e += 1) {
        edgeSource[edgeOffset + e] = snapshot.edgeSource[e] + nodeOffset;
        edgeTarget[edgeOffset + e] = snapshot.edgeTarget[e] + nodeOffset;
      }

      nodeOffset += snapshot.nodeCount;
      edgeOffset += snapshot.edgeCount;
    }

    return { nodeCount, edgeCount, positions, edgeSource, edgeTarget };
  }

  private createShards(nodeCount: number, shardCount: number): ShardInfo[] {
    const shards: ShardInfo[] = [];
    const base = Math.floor(nodeCount / shardCount);
    const remainder = nodeCount % shardCount;

    let cursor = 0;
    for (let i = 0; i < shardCount; i += 1) {
      const count = base + (i < remainder ? 1 : 0);
      shards.push({ start: cursor, count });
      cursor += count;
    }

    return shards;
  }

  private partitionEdges(edges: Uint32Array, shards: ShardInfo[]): Uint32Array[] {
    const buckets: number[][] = Array.from({ length: shards.length }, () => []);

    for (let i = 0; i + 1 < edges.length; i += 2) {
      const src = edges[i];
      const dst = edges[i + 1];
      const srcShard = this.shardIndexForNode(src, shards);
      const dstShard = this.shardIndexForNode(dst, shards);

      if (srcShard < 0 || dstShard < 0 || srcShard !== dstShard) {
        continue;
      }

      const shard = shards[srcShard];
      buckets[srcShard].push(src - shard.start, dst - shard.start);
    }

    return buckets.map((bucket) => Uint32Array.from(bucket));
  }

  private shardIndexForNode(nodeIndex: number, shards: ShardInfo[]): number {
    let low = 0;
    let high = shards.length - 1;

    while (low <= high) {
      const mid = low + Math.floor((high - low) / 2);
      const shard = shards[mid];
      if (nodeIndex < shard.start) {
        high = mid - 1;
      } else if (nodeIndex >= shard.start + shard.count) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    return -1;
  }

  private slicePositions(positions: Float32Array | undefined, start: number, count: number): Float32Array | undefined {
    if (!positions) {
      return undefined;
    }

    return positions.slice(start * 2, (start + count) * 2);
  }
}
