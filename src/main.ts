import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'
import { PointPair } from './PointPair'
import { PointPairManager } from './PointPairManager'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)

const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 3, 10, Vector3.Zero(), scene)
camera.attachControl(canvas, true)
new HemisphericLight('h', new Vector3(0, 1, 0), scene)

const bigRadius = 1.5
const bigSphere = MeshBuilder.CreateSphere('big', { diameter: bigRadius * 2, segments: 32 }, scene)
const bigMat = new StandardMaterial('bigMat', scene)
bigMat.diffuseColor = new Color3(0.6, 0.7, 1)
bigMat.alpha = 0.25
bigMat.specularColor = new Color3(0.3, 0.3, 0.4)
bigSphere.material = bigMat
bigSphere.isPickable = false

// Ground
const ground = MeshBuilder.CreateGround('ground', { width: 30, height: 30 }, scene)
ground.position.y = -1.5
const groundMat = new GridMaterial('groundMat', scene)
groundMat.opacity = 0.8
ground.material = groundMat

// Plane for mercator projection
const planeWidth = 4 * bigRadius
const planeHeight = 4 * bigRadius
const planeX = 4 * bigRadius
const plane = MeshBuilder.CreatePlane('mercPlane', { width: planeWidth, height: planeHeight }, scene)
plane.position = new Vector3(planeX, 0, 0)
plane.rotation = new Vector3(0, Math.PI / 2, 0)
const planeMat = new GridMaterial('planeMat', scene)
planeMat.mainColor = new Color3(0.3, 0.3, 0.3)
plane.material = planeMat


const manager = new PointPairManager()

// creat point pair via manager
manager.create({
  id: 'pair1',
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  initialLat: 0,
  initialLon: 0,
})

// Create one PointPair (you can create more later)
const pair = new PointPair({
  id: 'pair1',
  scene,
  bigRadius,
  plane,
  planeWidth,
  planeHeight,
  initialLat: 0,
  initialLon: 0,
})

// parent the 3D sphere to the big sphere? For now keep independent

engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
