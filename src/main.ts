import { sceneManager } from './SceneManager'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'
import { PointPairManager } from './PointPairManager'
import { Chart } from './charts'
import { line } from 'd3'

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

sceneManager.getEngine().runRenderLoop(() => {
  // render the scene
  scene.render()
  // resolve collisions each frame so dragged pairs are separated in real-time
  pointManager.resolveCollisions()
})
window.addEventListener('resize', () => sceneManager.getEngine().resize())
