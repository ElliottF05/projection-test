import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Mesh, PointerEventTypes, Ray, Matrix, SixDofDragBehavior, DynamicTexture, Color4, Camera } from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'

const maxLat = 89 * Math.PI / 180; // max latitude in radians to avoid poles in Mercator

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)

const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 3, 10, Vector3.Zero(), scene)
camera.attachControl(canvas, true)

new HemisphericLight('h', new Vector3(0, 1, 0), scene)


// Large mostly transparent sphere at origin
const bigRadius = 1.5;
const bigSphere = MeshBuilder.CreateSphere('big', { diameter: bigRadius * 2, segments: 32 }, scene)
const bigMat = new StandardMaterial('bigMat', scene)
bigMat.diffuseColor = new Color3(0.6, 0.7, 1)
bigMat.alpha = 0.25
bigMat.specularColor = new Color3(0.3, 0.3, 0.4)
bigSphere.material = bigMat
bigSphere.isPickable = false


// Grid floor
const ground = MeshBuilder.CreateGround('ground', { width: 30, height: 30 }, scene)
ground.position.y = -1.5;
const groundMat = new GridMaterial('groundMat', scene);
groundMat.opacity = 0.8;
groundMat.minorUnitVisibility = 0.6;
groundMat.lineColor = new Color3(0.8, 0.8, 0.8);
ground.material = groundMat


// Floating 2D rectangle (plane) for Mercator testing, placed to the +X side of the big sphere
const planeWidth = 4 * bigRadius;
const planeHeight = 4 * bigRadius;
const planeX = 4 * bigRadius;
const plane = MeshBuilder.CreatePlane('mercPlane', { width: planeWidth, height: planeHeight }, scene)
plane.position = new Vector3(planeX, 0, 0)
// rotate so the plane faces -X (so it looks toward the sphere)
plane.rotation = new Vector3(0, Math.PI / 2, 0)

const planeMat = new GridMaterial('planeMat', scene)
planeMat.mainColor = new Color3(0.3, 0.3, 0.3)
plane.material = planeMat


// Small draggable sphere
const sphere = MeshBuilder.CreateSphere('small', { diameter: 0.2 * bigRadius }, scene)
sphere.position = new Vector3(bigRadius, 0.0, 0)
const smallMat = new StandardMaterial('smallMat', scene)
smallMat.diffuseColor = Color3.Red()
sphere.material = smallMat


// Small marker sphere that will be placed on the plane using Mercator projection
const projectedSphere = MeshBuilder.CreateSphere('planeMarker', { diameter: 0.2 * bigRadius }, scene)
const projectedSphereMat = new StandardMaterial('markerMat', scene)
projectedSphereMat.diffuseColor = new Color3(1, 0.8, 0)
projectedSphere.material = projectedSphereMat
// Parent marker to plane so we can set its local coordinates (z=0 is on plane surface)
projectedSphere.parent = plane


// Mercator helper: take latitude & longitude in radians
function mercatorNormalizedXY(latRad: number, lonRad: number) {
  // clamp latitude to avoid infinity at poles
  const lat = Math.max(Math.min(latRad, maxLat), -maxLat)
  const x = lonRad // range -PI..PI
  const y = Math.log(Math.tan(Math.PI / 4 + lat / 2)) // range roughly -maxY..maxY
  const maxY = Math.log(Math.tan(Math.PI / 4 + maxLat / 2))
  const nx = x / Math.PI // -1..1
  const ny = y / maxY // -1..1
  return { nx, ny }
}

// Inverse Mercator: from normalized XY [-1,1] to lat/lon (radians)
function inverseMercatorNormalizedXY(nx: number, ny: number) {
  const lon = nx * Math.PI;
  const maxY = Math.log(Math.tan(Math.PI / 4 + maxLat / 2));
  const y = ny * maxY;
  const lat = 2 * Math.atan(Math.exp(y)) - Math.PI / 2;
  return { lat, lon };
}

// Convert lat/lon (radians) to 3D position on sphere of given radius
function latLonToVec3(lat: number, lon: number, radius: number) {
  const y = Math.sin(lat) * radius;
  const r = Math.cos(lat) * radius;
  const x = Math.cos(lon) * r;
  const z = Math.sin(lon) * r;
  return new Vector3(x, y, z);
}


const sphereDragBehavior = new SixDofDragBehavior();
sphereDragBehavior.onPositionChangedObservable.add(() => {
  // Project sphere's position onto globe surface
  sphere.position = projectOntoSphere(sphere.position, bigRadius);

  // compute spherical lat/lon of small's position (assume sphere centered at origin)
  const p = sphere.position.clone();
  p.normalize();
  const lat = Math.asin(p.y) // -PI/2..PI/2
  const lon = Math.atan2(p.z, p.x) // -PI..PI (x is 0deg)

  // Mercator normalized coords in [-1,1]
  const { nx, ny } = mercatorNormalizedXY(lat, lon)

  // place marker on plane local XY (plane width/height maps -1..1 to extents)
  projectedSphere.position.x = nx * (planeWidth / 2)
  projectedSphere.position.y = ny * (planeHeight / 2)
});
sphere.addBehavior(sphereDragBehavior);


// Drag behavior for projectedSphere (on the plane)
const projectedDragBehavior = new SixDofDragBehavior();
projectedDragBehavior.onPositionChangedObservable.add(() => {
  projectedSphere.position.z = 0; // keep on plane
  projectedSphere.position.x = Math.min(Math.max(projectedSphere.position.x, -planeWidth / 2), planeWidth / 2); // keep within plane bounds
  projectedSphere.position.y = Math.min(Math.max(projectedSphere.position.y, -planeHeight / 2), planeHeight / 2); // keep within plane bounds

  // Get local position of marker on plane
  const localPos = projectedSphere.position.clone();

  // Convert to normalized Mercator XY
  const nx = localPos.x / (planeWidth / 2);
  const ny = localPos.y / (planeHeight / 2);

  // Inverse Mercator to get lat/lon
  const { lat, lon } = inverseMercatorNormalizedXY(nx, ny);

  // Convert to 3D position on globe
  const globePos = latLonToVec3(lat, lon, bigRadius);

  // Update the globe sphere's position and project it onto the sphere
  sphere.position = globePos;
});
projectedSphere.addBehavior(projectedDragBehavior);


engine.runRenderLoop(() => {
  scene.render()
})

window.addEventListener('resize', () => {
  engine.resize()
})

// Utility: project point onto sphere centered at origin
function projectOntoSphere(point: Vector3, radius: number) {
  const dir = point.normalize()
  return dir.scale(radius)
}
