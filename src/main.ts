import { sceneManager } from './SceneManager'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'
import { PointPairManager } from './PointPairManager'
import { Chart } from './charts'
import { line } from 'd3'
import { ChartPair } from './ChartPair'
import { toggleProjectionMode, getProjectionMode } from './projection'

// initialize scene
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
sceneManager.init(canvas)
const scene = sceneManager.getScene()

const env = sceneManager.createEnvironment({ bigRadius: 1.5 })
const { bigSphere, bigRadius, ground, plane, planeWidth, planeHeight } = env

const pointManager = new PointPairManager()

// creat point pair via manager
pointManager.create({
  id: 'pair1',
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  initialLat: 0,
  initialLon: 0,
})
pointManager.create({
  id: 'pair2',
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  initialLat: Math.PI / 4.0,
  initialLon: 0,
})

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
