interface BodyAccessor {
  getX(index: number): number;
  getY(index: number): number;
  getMass(index: number): number;
}

class QuadNode {
  public mass = 0;
  public comX = 0;
  public comY = 0;
  public bodies: number[] = [];
  public children: [QuadNode, QuadNode, QuadNode, QuadNode] | null = null;

  public constructor(
    public readonly minX: number,
    public readonly minY: number,
    public readonly maxX: number,
    public readonly maxY: number,
    public readonly depth: number
  ) {}

  public get isLeaf(): boolean {
    return this.children === null;
  }
}

export class BarnesHutTree {
  private root: QuadNode | null = null;

  public constructor(
    private readonly bodies: BodyAccessor,
    private readonly minDistance: number,
    private readonly maxDepth = 20
  ) {}

  public build(indices: number[]): void {
    if (indices.length === 0) {
      this.root = null;
      return;
    }

    const first = indices[0] as number;
    let minX = this.bodies.getX(first);
    let maxX = minX;
    let minY = this.bodies.getY(first);
    let maxY = minY;

    for (let i = 1; i < indices.length; i += 1) {
      const index = indices[i] as number;
      const x = this.bodies.getX(index);
      const y = this.bodies.getY(index);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const side = Math.max(maxX - minX, maxY - minY) || 1;
    const padding = side * 0.01 + this.minDistance;
    this.root = new QuadNode(minX - padding, minY - padding, maxX + padding, maxY + padding, 0);

    for (let i = 0; i < indices.length; i += 1) {
      this.insert(this.root, indices[i] as number);
    }
  }

  public computeRepulsion(index: number, repulsionStrength: number, theta: number): [number, number] {
    if (!this.root) {
      return [0, 0];
    }

    const sourceX = this.bodies.getX(index);
    const sourceY = this.bodies.getY(index);
    let fx = 0;
    let fy = 0;
    const stack: QuadNode[] = [this.root];
    const thetaSq = theta * theta;

    while (stack.length > 0) {
      const node = stack.pop() as QuadNode;
      if (node.mass <= 0) {
        continue;
      }

      if (node.isLeaf) {
        const bodyCount = node.bodies.length;
        for (let i = 0; i < bodyCount; i += 1) {
          const target = node.bodies[i] as number;
          if (target === index) {
            continue;
          }

          const dx = this.bodies.getX(target) - sourceX;
          const dy = this.bodies.getY(target) - sourceY;
          const distSq = dx * dx + dy * dy + this.minDistance * this.minDistance;
          const invDist = 1 / Math.sqrt(distSq);
          const invDist3 = invDist * invDist * invDist;
          const scalar = repulsionStrength * this.bodies.getMass(target) * invDist3;

          fx -= dx * scalar;
          fy -= dy * scalar;
        }
        continue;
      }

      const dx = node.comX - sourceX;
      const dy = node.comY - sourceY;
      const distSq = dx * dx + dy * dy + this.minDistance * this.minDistance;
      const width = node.maxX - node.minX;

      if ((width * width) / distSq < thetaSq) {
        const invDist = 1 / Math.sqrt(distSq);
        const invDist3 = invDist * invDist * invDist;
        const scalar = repulsionStrength * node.mass * invDist3;

        fx -= dx * scalar;
        fy -= dy * scalar;
      } else if (node.children) {
        stack.push(node.children[0], node.children[1], node.children[2], node.children[3]);
      }
    }

    return [fx, fy];
  }

  private insert(node: QuadNode, bodyIndex: number): void {
    this.accumulate(node, bodyIndex);

    if (node.isLeaf) {
      if (node.bodies.length === 0 || node.depth >= this.maxDepth) {
        node.bodies.push(bodyIndex);
        return;
      }

      const existing = node.bodies[0] as number;
      const sameSpot =
        this.bodies.getX(existing) === this.bodies.getX(bodyIndex) &&
        this.bodies.getY(existing) === this.bodies.getY(bodyIndex);

      if (sameSpot) {
        node.bodies.push(bodyIndex);
        return;
      }

      this.subdivide(node);
      node.bodies = [];
      this.insert(this.childFor(node, existing), existing);
      this.insert(this.childFor(node, bodyIndex), bodyIndex);
      return;
    }

    this.insert(this.childFor(node, bodyIndex), bodyIndex);
  }

  private subdivide(node: QuadNode): void {
    const midX = (node.minX + node.maxX) / 2;
    const midY = (node.minY + node.maxY) / 2;

    node.children = [
      new QuadNode(node.minX, node.minY, midX, midY, node.depth + 1),
      new QuadNode(midX, node.minY, node.maxX, midY, node.depth + 1),
      new QuadNode(node.minX, midY, midX, node.maxY, node.depth + 1),
      new QuadNode(midX, midY, node.maxX, node.maxY, node.depth + 1),
    ];
  }

  private childFor(node: QuadNode, bodyIndex: number): QuadNode {
    const children = node.children;
    if (!children) {
      throw new Error("childFor called on leaf node");
    }

    const x = this.bodies.getX(bodyIndex);
    const y = this.bodies.getY(bodyIndex);
    const midX = (node.minX + node.maxX) / 2;
    const midY = (node.minY + node.maxY) / 2;
    const right = x >= midX ? 1 : 0;
    const bottom = y >= midY ? 2 : 0;
    return children[right + bottom] as QuadNode;
  }

  private accumulate(node: QuadNode, bodyIndex: number): void {
    const bodyMass = this.bodies.getMass(bodyIndex);
    const nextMass = node.mass + bodyMass;
    if (nextMass <= 0) {
      return;
    }

    const x = this.bodies.getX(bodyIndex);
    const y = this.bodies.getY(bodyIndex);

    node.comX = (node.comX * node.mass + x * bodyMass) / nextMass;
    node.comY = (node.comY * node.mass + y * bodyMass) / nextMass;
    node.mass = nextMass;
  }
}
