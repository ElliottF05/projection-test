import { PointPair } from './PointPair'

export class PointPairManager {
    pairs: PointPair[] = []
    
    create(options: ConstructorParameters<typeof PointPair>[0]) {
        const pair = new PointPair(options)
        this.add(pair)
        return pair
    }
    
    add(pair: PointPair) {
        this.pairs.push(pair)
    }
    
    remove(pairOrId: PointPair | string) {
        const id = typeof pairOrId === 'string' ? pairOrId : pairOrId.id
        const idx = this.pairs.findIndex(p => p.id === id)
        if (idx >= 0) this.pairs.splice(idx, 1)
        }
    
    forEach(fn: (p: PointPair) => void) {
        this.pairs.forEach(fn)
    }
    
    // placeholder for future collision resolution
    resolveCollisions() {
        // Two-pass collision resolution:
        // 1) 3D pass: check distances on sphere surface (Euclidean in 3D) and separate overlapping pairs
        // 2) 2D pass: check distances on the projection plane (local plane coordinates) and separate overlaps
        
        // 3D pass
        for (let i = 0; i < this.pairs.length; i++) {
            for (let j = i + 1; j < this.pairs.length; j++) {
                const a = this.pairs[i]
                const b = this.pairs[j]
                const pa = a.sphere.position
                const pb = b.sphere.position
                const delta = pb.subtract(pa)
                const dist = delta.length()
                const minDist = (a.radius3D + b.radius3D)
                if (dist > 0 && dist < minDist) {
                    const overlap = minDist - dist
                    const push = delta.normalize().scale(overlap / 2)
                    // move both points away along the delta direction
                    a.setSpherePosition(pa.subtract(push))
                    b.setSpherePosition(pb.add(push))
                } else if (dist === 0) {
                    // Exact same position: nudge along arbitrary axis
                    const push = new (pa.constructor as any)(0.001, 0.001, 0.001)
                    a.setSpherePosition(pa.subtract(push))
                    b.setSpherePosition(pb.add(push))
                }
            }
        }
        
        // 2D pass (plane local coords). Use projected.parent to get local positions
        for (let i = 0; i < this.pairs.length; i++) {
            for (let j = i + 1; j < this.pairs.length; j++) {
                const a = this.pairs[i]
                const b = this.pairs[j]
                // both projected are parented to the same plane, so positions are local
                const pa = a.projected.position
                const pb = b.projected.position
                const dx = pb.x - pa.x
                const dy = pb.y - pa.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                const minDist = (a.radius2D + b.radius2D)
                if (dist > 0 && dist < minDist) {
                    const overlap = minDist - dist
                    const nx = dx / dist
                    const ny = dy / dist
                    const pushX = nx * (overlap / 2)
                    const pushY = ny * (overlap / 2)
                    a.setProjectedLocalPosition(new (pa.constructor as any)(pa.x - pushX, pa.y - pushY, 0))
                    b.setProjectedLocalPosition(new (pb.constructor as any)(pb.x + pushX, pb.y + pushY, 0))
                } else if (dist === 0) {
                    // exact overlap, nudge arbitrarily in X
                    a.setProjectedLocalPosition(new (pa.constructor as any)(pa.x - 0.01, pa.y, 0))
                    b.setProjectedLocalPosition(new (pb.constructor as any)(pb.x + 0.01, pb.y, 0))
                }
            }
        }
    }
}