import { describe, expect, it } from "vitest";
import { ForceGraph, JsEdgeAttractionKernel } from "../src/index.js";

function makeMockContext(): CanvasRenderingContext2D {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fill: () => undefined,
    arc: () => undefined,
    fillRect: () => undefined,
    clearRect: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  return context;
}

describe("ForceGraph", () => {
  it("updates connected nodes during step", () => {
    const graph = new ForceGraph<string>({ initialSpread: 0, activeSetEnabled: false });

    graph.addNode("a", { x: -10, y: 0, z: -5 });
    graph.addNode("b", { x: 10, y: 0, z: 5 });
    graph.addEdge("a", "b", 1);

    const beforeA = graph.getNodePosition("a");
    const beforeB = graph.getNodePosition("b");
    expect(beforeA).not.toBeNull();
    expect(beforeB).not.toBeNull();

    graph.step(5);

    const afterA = graph.getNodePosition("a");
    const afterB = graph.getNodePosition("b");

    expect(afterA).not.toBeNull();
    expect(afterB).not.toBeNull();
    expect(afterA!.x).not.toBe(beforeA!.x);
    expect(afterB!.x).not.toBe(beforeB!.x);
    expect(afterA!.z).not.toBe(beforeA!.z);
    expect(Number.isFinite(afterA!.x)).toBe(true);
    expect(Number.isFinite(afterB!.y)).toBe(true);
  });

  it("supports active-set and adaptive theta summary", () => {
    const graph = new ForceGraph<number>({
      initialSpread: 0,
      activeSetEnabled: true,
      coldNodeUpdateInterval: 20,
      sleepVelocityThreshold: 0.4,
      adaptiveThetaEnabled: true,
    });

    for (let i = 0; i < 5000; i += 1) {
      graph.addNode(i, { x: i % 100, y: Math.floor(i / 100) });
    }

    for (let i = 0; i < 2500; i += 1) {
      graph.addEdge(i, i + 1, 1);
    }

    const summary = graph.step(1);

    expect(summary.activeNodeCount).toBeLessThan(graph.nodeCount);
    expect(summary.theta).toBeGreaterThan(0);
  });

  it("handles >100k nodes and edges without invalid coordinates", { timeout: 60_000 }, () => {
    const nodeCount = 100_500;
    const edgeCount = 100_500;

    const graph = new ForceGraph<number>({
      repulsionStrength: 30,
      springStrength: 0.03,
      springLength: 8,
      damping: 0.92,
      timeStep: 0.2,
      theta: 1,
      maxSpeed: 4,
      initialSpread: 1000,
    });

    for (let i = 0; i < nodeCount; i += 1) {
      graph.addNode(i, { x: (i % 1000) - 500, y: Math.floor(i / 1000) - 50 });
    }

    for (let i = 0; i < edgeCount; i += 1) {
      graph.addEdge(i % nodeCount, (i + 1) % nodeCount, 1);
    }

    graph.setWasmKernel(new JsEdgeAttractionKernel());
    const summary = graph.step(1);

    expect(summary.iterationCount).toBe(1);
    expect(summary.averageSpeed).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < nodeCount; i += 10_000) {
      const node = graph.nodeAt(i);
      expect(node).not.toBeNull();
      expect(Number.isFinite(node!.x)).toBe(true);
      expect(Number.isFinite(node!.y)).toBe(true);
      expect(Number.isFinite(node!.z)).toBe(true);
    }
  });

  it("exports render snapshot with remapped edges", () => {
    const graph = new ForceGraph<number>({ initialSpread: 0, activeSetEnabled: false });
    for (let i = 0; i < 100; i += 1) {
      graph.addNode(i, { x: i, y: i, z: i / 2, appearance: { radius: 2 + (i % 3), color: "#336699" } });
      if (i > 0) {
        graph.addEdge(i - 1, i, { weight: 1, appearance: { width: 1 + (i % 2), color: "#999999" } });
      }
    }

    const snapshot = graph.exportRenderSnapshot(20, 20);
    expect(snapshot.nodeCount).toBeGreaterThan(0);
    expect(snapshot.positions.length).toBe(snapshot.nodeCount * 3);
    expect(snapshot.nodeRadii.length).toBe(snapshot.nodeCount);
    expect(snapshot.nodeColors.length).toBe(snapshot.nodeCount * 4);
    expect(snapshot.edgeCount).toBeLessThanOrEqual(20);
    expect(snapshot.edgeWidths.length).toBe(snapshot.edgeCount);
    expect(snapshot.edgeColors.length).toBe(snapshot.edgeCount * 4);
  });

  it("draws with capped budgets and does not throw", () => {
    const graph = new ForceGraph<number>({ initialSpread: 0 });
    for (let i = 0; i < 5000; i += 1) {
      graph.addNode(i, { x: i % 300, y: Math.floor(i / 300) });
    }

    for (let i = 0; i < 5000; i += 1) {
      graph.addEdge(i, (i + 1) % 5000, 1);
    }

    const ctx = makeMockContext();

    expect(() => {
      graph.draw(ctx, {
        width: 800,
        height: 600,
        scale: 1,
        maxDrawNodes: 1000,
        maxDrawEdges: 1000,
      });
    }).not.toThrow();
  });

  it("supports configurable gravity and appearance updates", () => {
    const graph = new ForceGraph<string>({
      initialSpread: 0,
      activeSetEnabled: false,
      gravity: 0.1,
      gravityMode: "directional",
      gravityDirectionY: -1,
      gravityDirectionX: 0,
      gravityDirectionZ: 0,
    });

    graph.addNode("a", { x: 0, y: 10, z: 0, appearance: { color: "#ff0000", radius: 4 } });
    graph.addNode("b", { x: 0, y: 20, z: 10 });
    const edgeIndex = graph.addEdge("a", "b", { weight: 0.2, appearance: { color: "#00ff00", width: 3 } });

    graph.setNodeAppearance("b", { color: "#0000ff", radius: 6 });
    graph.setEdgeAppearance(edgeIndex, { width: 5 });
    graph.step(3);

    const a = graph.getNodePosition("a");
    const b = graph.getNodePosition("b");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.y).toBeLessThan(10);
    expect(Math.abs(b!.y - 20)).toBeGreaterThan(0);

    const snapshot = graph.exportRenderSnapshot();
    expect(snapshot.nodeRadii[1]).toBe(6);
    expect(snapshot.edgeWidths[0]).toBe(5);
  });
});
