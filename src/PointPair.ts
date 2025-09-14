import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, SixDofDragBehavior, Vector3 } from '@babylonjs/core'
import { mercatorNormalizedXY, inverseMercatorNormalizedXY, latLonToVec3, projectOntoSphere } from './projection'

export interface PointPairOptions {
    id: string
    scene: Scene
    bigRadius: number
    plane: Mesh
    planeWidth: number
    planeHeight: number
    initialLat?: number
    initialLon?: number
    color?: Color3
}

export class PointPair {
    public readonly id: string
    public sphere: Mesh
    public projected: Mesh
    private opts: PointPairOptions
    private ignoreSphere = false
    private ignoreProjected = false
    
    constructor(opts: PointPairOptions) {
        this.id = opts.id
        this.opts = opts
        const { scene, id, bigRadius } = opts

        const color = opts.color || Color3.Random()
        
        // 3D sphere
        this.sphere = MeshBuilder.CreateSphere(id + '_3d', { diameter: 0.2 * bigRadius }, scene)
        const sMat = new StandardMaterial(id + '_3d_mat', scene)
        sMat.diffuseColor = color
        this.sphere.material = sMat
        
        // projected marker (parented to plane later)
        this.projected = MeshBuilder.CreateSphere(id + '_proj', { diameter: 0.2 * bigRadius }, scene)
        const pMat = new StandardMaterial(id + '_proj_mat', scene)
        pMat.diffuseColor = color
        this.projected.material = pMat
        
        // place initial position if provided
        if (typeof opts.initialLat === 'number' && typeof opts.initialLon === 'number') {
            const v = latLonToVec3(opts.initialLat, opts.initialLon, bigRadius)
            this.sphere.position = v
            const { nx, ny } = mercatorNormalizedXY(opts.initialLat, opts.initialLon)
            this.projected.position = new Vector3(nx * (opts.planeWidth / 2), ny * (opts.planeHeight / 2), 0)
        } else {
            // default placement
            this.sphere.position = new Vector3(bigRadius, 0, 0)
            const { nx, ny } = mercatorNormalizedXY(0, 0)
            this.projected.position = new Vector3(nx * (opts.planeWidth / 2), ny * (opts.planeHeight / 2), 0)
        }
        
        // parent projected to plane for local coords
        this.projected.parent = opts.plane
        
        this.setupBehaviors()
    }
    
    private setupBehaviors() {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        
        const sphereDrag = new SixDofDragBehavior()
        sphereDrag.onPositionChangedObservable.add(() => {
            if (this.ignoreSphere) return
            // Project onto sphere surface
            this.sphere.position = projectOntoSphere(this.sphere.position, bigRadius)
            
            // compute lat/lon
            const p = this.sphere.position.clone().normalize()
            const lat = Math.asin(p.y)
            const lon = Math.atan2(p.z, p.x)
            
            // update projected marker
            this.ignoreProjected = true
            const { nx, ny } = mercatorNormalizedXY(lat, lon)
            this.projected.position.x = nx * (planeWidth / 2)
            this.projected.position.y = ny * (planeHeight / 2)
            this.ignoreProjected = false
        })
        this.sphere.addBehavior(sphereDrag)
        
        const projDrag = new SixDofDragBehavior()
        projDrag.onPositionChangedObservable.add(() => {
            if (this.ignoreProjected) return
            // clamp to plane extents
            this.projected.position.z = 0
            this.projected.position.x = Math.min(Math.max(this.projected.position.x, -planeWidth / 2), planeWidth / 2)
            this.projected.position.y = Math.min(Math.max(this.projected.position.y, -planeHeight / 2), planeHeight / 2)
            
            const nx = this.projected.position.x / (planeWidth / 2)
            const ny = this.projected.position.y / (planeHeight / 2)
            const { lat, lon } = inverseMercatorNormalizedXY(nx, ny)
            
            this.ignoreSphere = true
            const globePos = latLonToVec3(lat, lon, bigRadius)
            this.sphere.position = globePos
            this.ignoreSphere = false
        })
        this.projected.addBehavior(projDrag)
    }
}
