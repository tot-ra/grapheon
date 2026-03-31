class OctNode {
    constructor(minX, minY, minZ, maxX, maxY, maxZ, depth) {
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
        this.depth = depth;
        this.mass = 0;
        this.comX = 0;
        this.comY = 0;
        this.comZ = 0;
        this.bodies = [];
        this.children = null;
    }
    get isLeaf() {
        return this.children === null;
    }
}
export class BarnesHutTree {
    constructor(bodies, minDistance, maxDepth = 18) {
        this.bodies = bodies;
        this.minDistance = minDistance;
        this.maxDepth = maxDepth;
        this.root = null;
    }
    build(indices) {
        if (indices.length === 0) {
            this.root = null;
            return;
        }
        const first = indices[0];
        let minX = this.bodies.getX(first);
        let maxX = minX;
        let minY = this.bodies.getY(first);
        let maxY = minY;
        let minZ = this.bodies.getZ(first);
        let maxZ = minZ;
        for (let i = 1; i < indices.length; i += 1) {
            const index = indices[i];
            const x = this.bodies.getX(index);
            const y = this.bodies.getY(index);
            const z = this.bodies.getZ(index);
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
            if (y < minY)
                minY = y;
            if (y > maxY)
                maxY = y;
            if (z < minZ)
                minZ = z;
            if (z > maxZ)
                maxZ = z;
        }
        const side = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
        const padding = side * 0.01 + this.minDistance;
        this.root = new OctNode(minX - padding, minY - padding, minZ - padding, maxX + padding, maxY + padding, maxZ + padding, 0);
        for (let i = 0; i < indices.length; i += 1) {
            this.insert(this.root, indices[i]);
        }
    }
    computeRepulsion(index, repulsionStrength, theta) {
        if (!this.root) {
            return [0, 0, 0];
        }
        const sourceX = this.bodies.getX(index);
        const sourceY = this.bodies.getY(index);
        const sourceZ = this.bodies.getZ(index);
        let fx = 0;
        let fy = 0;
        let fz = 0;
        const stack = [this.root];
        const thetaSq = theta * theta;
        while (stack.length > 0) {
            const node = stack.pop();
            if (node.mass <= 0) {
                continue;
            }
            if (node.isLeaf) {
                for (let i = 0; i < node.bodies.length; i += 1) {
                    const target = node.bodies[i];
                    if (target === index) {
                        continue;
                    }
                    const dx = this.bodies.getX(target) - sourceX;
                    const dy = this.bodies.getY(target) - sourceY;
                    const dz = this.bodies.getZ(target) - sourceZ;
                    const distSq = dx * dx + dy * dy + dz * dz + this.minDistance * this.minDistance;
                    const invDist = 1 / Math.sqrt(distSq);
                    const invDist3 = invDist * invDist * invDist;
                    const scalar = repulsionStrength * this.bodies.getMass(target) * invDist3;
                    fx -= dx * scalar;
                    fy -= dy * scalar;
                    fz -= dz * scalar;
                }
                continue;
            }
            const dx = node.comX - sourceX;
            const dy = node.comY - sourceY;
            const dz = node.comZ - sourceZ;
            const distSq = dx * dx + dy * dy + dz * dz + this.minDistance * this.minDistance;
            const width = node.maxX - node.minX;
            if ((width * width) / distSq < thetaSq) {
                const invDist = 1 / Math.sqrt(distSq);
                const invDist3 = invDist * invDist * invDist;
                const scalar = repulsionStrength * node.mass * invDist3;
                fx -= dx * scalar;
                fy -= dy * scalar;
                fz -= dz * scalar;
            }
            else if (node.children) {
                for (let i = 0; i < node.children.length; i += 1) {
                    stack.push(node.children[i]);
                }
            }
        }
        return [fx, fy, fz];
    }
    insert(node, bodyIndex) {
        this.accumulate(node, bodyIndex);
        if (node.isLeaf) {
            if (node.bodies.length === 0 || node.depth >= this.maxDepth) {
                node.bodies.push(bodyIndex);
                return;
            }
            const existing = node.bodies[0];
            const sameSpot = this.bodies.getX(existing) === this.bodies.getX(bodyIndex) &&
                this.bodies.getY(existing) === this.bodies.getY(bodyIndex) &&
                this.bodies.getZ(existing) === this.bodies.getZ(bodyIndex);
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
    subdivide(node) {
        const midX = (node.minX + node.maxX) / 2;
        const midY = (node.minY + node.maxY) / 2;
        const midZ = (node.minZ + node.maxZ) / 2;
        node.children = [];
        for (let z = 0; z < 2; z += 1) {
            for (let y = 0; y < 2; y += 1) {
                for (let x = 0; x < 2; x += 1) {
                    node.children.push(new OctNode(x === 0 ? node.minX : midX, y === 0 ? node.minY : midY, z === 0 ? node.minZ : midZ, x === 0 ? midX : node.maxX, y === 0 ? midY : node.maxY, z === 0 ? midZ : node.maxZ, node.depth + 1));
                }
            }
        }
    }
    childFor(node, bodyIndex) {
        const children = node.children;
        if (!children) {
            throw new Error("childFor called on leaf node");
        }
        const x = this.bodies.getX(bodyIndex);
        const y = this.bodies.getY(bodyIndex);
        const z = this.bodies.getZ(bodyIndex);
        const midX = (node.minX + node.maxX) / 2;
        const midY = (node.minY + node.maxY) / 2;
        const midZ = (node.minZ + node.maxZ) / 2;
        const right = x >= midX ? 1 : 0;
        const bottom = y >= midY ? 2 : 0;
        const back = z >= midZ ? 4 : 0;
        return children[right + bottom + back];
    }
    accumulate(node, bodyIndex) {
        const bodyMass = this.bodies.getMass(bodyIndex);
        const nextMass = node.mass + bodyMass;
        if (nextMass <= 0) {
            return;
        }
        const x = this.bodies.getX(bodyIndex);
        const y = this.bodies.getY(bodyIndex);
        const z = this.bodies.getZ(bodyIndex);
        node.comX = (node.comX * node.mass + x * bodyMass) / nextMass;
        node.comY = (node.comY * node.mass + y * bodyMass) / nextMass;
        node.comZ = (node.comZ * node.mass + z * bodyMass) / nextMass;
        node.mass = nextMass;
    }
}
