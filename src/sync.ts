// import * as Y from 'yjs'
// import { WebsocketProvider } from 'y-websocket'
// import { YMap } from 'yjs/dist/src/internals'
// import { PointPair } from './PointPair'
// import { Vector3 } from '@babylonjs/core'
// import { PointPairManager } from './PointPairManager'

// // export function initSync() {
// //     const ydoc = new Y.Doc()
// //     const wsProvider = new WebsocketProvider('ws://localhost:1234', 'my-roomname', ydoc)

// //     wsProvider.on('status', event => {
// //     console.log(event.status) // logs "connected" or "disconnected"
// //     })

// //     wsProvider.on('sync', (state: boolean) => {
// //         console.log('y-websocket sync event, synced=', state)
// //     });

// //     const yarray = ydoc.getArray('my-array');
// //     yarray.observe(event => {
// //         console.log('y-array changed:', event)
// //     });

// //     yarray.insert(0, ['val'])
// // }

// type Vector3Data = { x: number, y: number, z: number }

// type PointPairData = {
//     id: string
//     pos: Vector3Data
// }

// function serializeVector3(v: Vector3): Vector3Data {
//     return { x: v.x, y: v.y, z: v.z }
// }
// function deserializeVector3(data: Vector3Data): Vector3 {
//     return new Vector3(data.x, data.y, data.z)
// }

// export class SyncManager {
//     ydoc: Y.Doc
//     wsProvider: WebsocketProvider
//     pointPairsMap: YMap<PointPairData>
//     pointPairManager?: PointPairManager

//     constructor() {
//         this.ydoc = new Y.Doc()
//         this.wsProvider = new WebsocketProvider('ws://localhost:1234', 'my-roomname', this.ydoc)
//         this.pointPairsMap = this.ydoc.getMap('pointPairsMap')


//         this.wsProvider.on('status', event => {
//             console.log('y-websocket status:', event.status) // connected/disconnected
//         })

//         this.wsProvider.on('sync', (state: boolean) => {
//             console.log('y-websocket sync event, synced=', state)
//         });
        
//         this.pointPairsMap.observe(event => {
//             console.log('pointPairsMap changed:', event);
//             for (const [key, change] of event.changes.keys) {
//                 const pointPair = this.pointPairManager?.pairs.get(key)!
//                 pointPair.setSpherePosition(deserializeVector3(this.pointPairsMap.get(key)!.pos), true)
//             }
//         })
//     }

//     setPointPairManager(manager: PointPairManager) {
//         this.pointPairManager = manager
//     }

//     registerPointPair(pointPair: PointPair) {
//         console.log('registering point pair for sync:', pointPair.id)

//         if (this.pointPairsMap.has(pointPair.id)) {
//             console.log('point pair already registered, updating position')
//             const posData = this.pointPairsMap.get(pointPair.id)!.pos
//             pointPair.setSpherePosition(deserializeVector3(posData), true)
//         } else {
//             this.pointPairsMap.set(pointPair.id, {
//                 id: pointPair.id,
//                 pos: serializeVector3(pointPair.sphere.position),
//             })
//         }
//     }
// }