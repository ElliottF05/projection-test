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
        
        // Reset all collision visuals first
        for (const p of this.pairs) {
            // hide both until detected
            p.showCollision3D(false) 
            p.showCollision2D(false)
        }

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
                    // show 3D collision visuals for both
                    a.showCollision3D(true)
                    b.showCollision3D(true)

                    const overlap = Math.max(minDist - dist, 0.0001)
                    const dir = delta.normalize()
                    // Only move the one that is currently being dragged. If both or neither are dragging, skip.
                    if (a.isDragging && !b.isDragging) {
                        // move a away from b by the full overlap
                        const push = dir.scale(-overlap)
                        a.setSpherePosition(pa.add(push))
                    } else if (b.isDragging && !a.isDragging) {
                        // move b away from a
                        const push = dir.scale(overlap)
                        b.setSpherePosition(pb.add(push))
                    } else {
                        // neither or both are dragging: do nothing for now
                    }
                } else if (dist === 0) {
                    // Exact same position: if one is dragging, nudge that one; otherwise skip
                    a.showCollision3D(true)
                    b.showCollision3D(true)
                    if (a.isDragging && !b.isDragging) {
                        a.setSpherePosition(pa.add(new (pa.constructor as any)(-0.001, -0.001, -0.001)))
                    } else if (b.isDragging && !a.isDragging) {
                        b.setSpherePosition(pb.add(new (pb.constructor as any)(0.001, 0.001, 0.001)))
                    }
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
                    a.showCollision2D(true)
                    b.showCollision2D(true)
                    const overlap = Math.max(minDist - dist, 0.0001)
                    const nx = dx / dist
                    const ny = dy / dist
                    // Only move the one that is being dragged
                    if (a.isDragging && !b.isDragging) {
                        a.setProjectedLocalPosition(new (pa.constructor as any)(pa.x - nx * overlap, pa.y - ny * overlap, 0))
                    } else if (b.isDragging && !a.isDragging) {
                        b.setProjectedLocalPosition(new (pb.constructor as any)(pb.x + nx * overlap, pb.y + ny * overlap, 0))
                    } else {
                        // neither or both dragging: do nothing
                    }
                } else if (dist === 0) {
                    a.showCollision2D(true)
                    b.showCollision2D(true)
                    // Exact same position: if one is dragging, nudge that one; otherwise skip
                    if (a.isDragging && !b.isDragging) {
                        a.setProjectedLocalPosition(new (pa.constructor as any)(pa.x - 0.01, pa.y, 0))
                    } else if (b.isDragging && !a.isDragging) {
                        b.setProjectedLocalPosition(new (pb.constructor as any)(pb.x + 0.01, pb.y, 0))
                    }
                }
            }
        }
    }
}