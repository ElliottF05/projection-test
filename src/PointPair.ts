import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, SixDofDragBehavior, Vector3 } from '@babylonjs/core'
import { mercatorNormalizedXY, inverseMercatorNormalizedXY, equirectangularNormalizedXY, inverseEquirectangularNormalizedXY, latLonToVec3, projectOntoSphere } from './projection'

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
    // collision radii (optional) - in world units
    collisionRadius3D?: number
    collisionRadius2D?: number
}

export class PointPair {
    public readonly id: string
    public sphere: Mesh
    public projected: Mesh
    // collision radii accessible publicly
    public radius3D: number
    public radius2D: number
    // visual collision helpers (mostly-transparent red)
    public collisionVis3D: Mesh
    public collisionVis2D: Mesh
    // whether this pair is currently being dragged by the user
    public isDragging: boolean = false
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
        
        // set default collision radii (can be overridden via options)
        const defaultRadius = 0.2 * bigRadius
        this.radius3D = opts.collisionRadius3D ?? defaultRadius
        this.radius2D = opts.collisionRadius2D ?? defaultRadius

        // create mostly-transparent red collision visuals
        this.collisionVis3D = MeshBuilder.CreateSphere(id + '_col3d', { diameter: this.radius3D * 2 }, scene)
        const col3Mat = new StandardMaterial(id + '_col3d_mat', scene)
        col3Mat.diffuseColor = new Color3(1, 0, 0)
        col3Mat.alpha = 0.25
        col3Mat.disableLighting = false
        this.collisionVis3D.material = col3Mat
        // position and parent to the sphere so it follows
        this.collisionVis3D.parent = this.sphere
        this.collisionVis3D.isVisible = false
        this.collisionVis3D.isPickable = false

        // 2D collision visual (parented to plane so local coordinates align)
        this.collisionVis2D = MeshBuilder.CreateSphere(id + '_col2d', { diameter: this.radius2D * 2 }, scene)
        const col2Mat = new StandardMaterial(id + '_col2d_mat', scene)
        col2Mat.diffuseColor = new Color3(1, 0, 0)
        col2Mat.alpha = 0.25
        col2Mat.disableLighting = false
        this.collisionVis2D.material = col2Mat
        this.collisionVis2D.parent = opts.plane
        // set to projected local position initially
        this.collisionVis2D.position = this.projected.position.clone()
        this.collisionVis2D.isVisible = false
        this.collisionVis2D.isPickable = false
        
        // place initial position if provided
        if (typeof opts.initialLat === 'number' && typeof opts.initialLon === 'number') {
            const v = latLonToVec3(opts.initialLat, opts.initialLon, bigRadius)
            this.sphere.position = v
            // const { nx, ny } = mercatorNormalizedXY(opts.initialLat, opts.initialLon)
            const { nx, ny } = equirectangularNormalizedXY(opts.initialLat, opts.initialLon)
            this.projected.position = new Vector3(nx * (opts.planeWidth / 2), ny * (opts.planeHeight / 2), 0)
        } else {
            // default placement
            this.sphere.position = new Vector3(bigRadius, 0, 0)
            // const { nx, ny } = mercatorNormalizedXY(0, 0)
            const { nx, ny } = equirectangularNormalizedXY(0, 0)
            this.projected.position = new Vector3(nx * (opts.planeWidth / 2), ny * (opts.planeHeight / 2), 0)
        }
        
        // parent projected to plane for local coords
        this.projected.parent = opts.plane
        
        this.setupBehaviors()
    }
    
    private setupBehaviors() {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        
        const sphereDrag = new SixDofDragBehavior()
        // update dragging flag on start/end and delegate position updates to setter
        sphereDrag.onDragStartObservable.add(() => { this.isDragging = true })
        sphereDrag.onDragEndObservable.add(() => { this.isDragging = false })
        sphereDrag.onPositionChangedObservable.add(() => {
            if (this.ignoreSphere) return
            // use setter which projects onto the sphere and updates the projected marker
            this.setSpherePosition(this.sphere.position.clone())
        })
        this.sphere.addBehavior(sphereDrag)
        
        const projDrag = new SixDofDragBehavior()
        projDrag.onDragStartObservable.add(() => { this.isDragging = true })
        projDrag.onDragEndObservable.add(() => { this.isDragging = false })
        projDrag.onPositionChangedObservable.add(() => {
            if (this.ignoreProjected) return
            // delegate to setter which clamps and updates the sphere
            this.setProjectedLocalPosition(this.projected.position.clone())
        })
        this.projected.addBehavior(projDrag)
        
    }
    
    // Public helper: set sphere position programmatically and update projected marker
    public setSpherePosition(newPos: Vector3) {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        this.ignoreSphere = true
        this.sphere.position = projectOntoSphere(newPos, bigRadius)
        
        // compute lat/lon and update projected marker without triggering its handler
        const p = this.sphere.position.clone().normalize()
        const lat = Math.asin(p.y)
        const lon = Math.atan2(p.z, p.x)
        // const { nx, ny } = mercatorNormalizedXY(lat, lon)
        const { nx, ny } = equirectangularNormalizedXY(lat, lon)
        
        this.ignoreProjected = true
        this.projected.position.x = nx * (planeWidth / 2)
        this.projected.position.y = ny * (planeHeight / 2)
        this.ignoreProjected = false
        
        this.ignoreSphere = false
    }
    
    // Public helper: set projected (local plane) position and update sphere accordingly
    public setProjectedLocalPosition(localPos: Vector3) {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        // clamp to plane extents
        const clampedX = Math.min(Math.max(localPos.x, -planeWidth / 2), planeWidth / 2)
        const clampedY = Math.min(Math.max(localPos.y, -planeHeight / 2), planeHeight / 2)
        
        this.ignoreProjected = true
        this.projected.position.x = clampedX
        this.projected.position.y = clampedY
        this.projected.position.z = 0
        this.ignoreProjected = false
        
        // convert to normalized and update sphere without triggering its handler
        const nx = clampedX / (planeWidth / 2)
        const ny = clampedY / (planeHeight / 2)
        // const { lat, lon } = inverseMercatorNormalizedXY(nx, ny)
        const { lat, lon } = inverseEquirectangularNormalizedXY(nx, ny)

        this.ignoreSphere = true
        const globePos = latLonToVec3(lat, lon, bigRadius)
        this.sphere.position = globePos
        this.ignoreSphere = false
    }

    // Collision visual controls
    public showCollision3D(visible: boolean) {
        if (!this.collisionVis3D) return
        this.collisionVis3D.isVisible = visible
    }

    public showCollision2D(visible: boolean) {
        if (!this.collisionVis2D) return
        // keep the visual at the projected local position
        this.collisionVis2D.position.x = this.projected.position.x
        this.collisionVis2D.position.y = this.projected.position.y
        this.collisionVis2D.position.z = 0
        this.collisionVis2D.isVisible = visible
    }
}
