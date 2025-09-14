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
    // implement pairwise checks and simple separation or other logic here
  }
}