import { sceneManager } from './SceneManager'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'
import { PointPairManager } from './PointPairManager'
import { Chart } from './charts'
import { line } from 'd3'
import { ChartPair } from './ChartPair'
import { toggleProjectionMode, getProjectionMode } from './projection'
import { SyncManager } from './sync'

// initialize scene
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
sceneManager.init(canvas)
const scene = sceneManager.getScene()

const env = sceneManager.createEnvironment({ bigRadius: 1.5 })
const { bigSphere, bigRadius, ground, plane, planeWidth, planeHeight } = env

const pointManager = new PointPairManager()
const syncManager = new SyncManager()

// wire circular references after construction
pointManager.setSyncManager(syncManager)
syncManager.setPointPairManager(pointManager)

// create point pair via manager
const p1 = pointManager.create(syncManager,{
  id: 'pair1',
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  initialLat: 0,
  initialLon: 0,
})

const p2 = pointManager.create(syncManager, {
  id: 'pair2',
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  initialLat: Math.PI / 4.0,
  initialLon: 0,
})

// register with sync
// sync.registerPointPair(p1)
// sync.registerPointPair(p2)

const chartPair = new ChartPair({
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  chartKind: 'line',
  initialLat: -Math.PI / 6,
  initialLon: Math.PI / 6,
})

syncManager.registerPointPair(p1);


sceneManager.getEngine().runRenderLoop(() => {
  // render the scene
  scene.render()
  // resolve collisions each frame so dragged pairs are separated in real-time
  pointManager.resolveCollisions()
})
window.addEventListener('resize', () => sceneManager.getEngine().resize())

// toggle projection mode with 'p'
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'p' || ev.key === 'P') {
    toggleProjectionMode()
    console.log('Projection mode is now', getProjectionMode())
  }
})
