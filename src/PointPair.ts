import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, SixDofDragBehavior, Vector3 } from '@babylonjs/core'
import { mercatorNormalizedXY, inverseMercatorNormalizedXY, equirectangularNormalizedXY, inverseEquirectangularNormalizedXY, latLonToVec3, projectOntoSphere, ProjectionMode, onProjectionModeChange, getProjectionMode } from '../packages/shared/projection'
import { SyncManager } from './sync'

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
    private projectedDragDistance: number | null = null
    
    // sync stuff
    private syncManager: SyncManager


    constructor(syncManager: SyncManager, opts: PointPairOptions) {
        this.syncManager = syncManager
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
            this.updateProjectedFromSphere()
        } else {
            // default placement
            this.sphere.position = new Vector3(bigRadius, 0, 0)
            // const { nx, ny } = mercatorNormalizedXY(0, 0)
            this.updateProjectedFromSphere()
        }
        
        // parent projected to plane for local coords
        this.projected.parent = opts.plane
        
        this.setupBehaviors()

        // listen for projection mode changes and update the projected marker accordingly
        onProjectionModeChange(() => this.updateProjectedFromSphere())
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
        projDrag.onDragEndObservable.add(() => {
            this.isDragging = false
            // clear stored planar drag distance
            this.projectedDragDistance = null
        })
        projDrag.onPositionChangedObservable.add(() => {
            if (this.ignoreProjected) return
            // delegate to setter which clamps and updates the sphere
            this.setProjectedLocalPosition(this.projected.position.clone())
        })
        this.projected.addBehavior(projDrag)
        // when a projected drag starts, record the current distance from the plane along its normal (planar mode)
        projDrag.onDragStartObservable.add(() => {
            if (getProjectionMode() !== ProjectionMode.Planar) return
            // compute world coordinates for the projected local position
            const worldPos = Vector3.TransformCoordinates(this.projected.position.clone(), this.opts.plane.getWorldMatrix())
            // compute plane normal in world space (transform local Z)
            const localNormal = new Vector3(0, 0, 1)
            const normalWorld = Vector3.TransformNormal(localNormal, this.opts.plane.getWorldMatrix()).normalize()
            // signed distance from plane point to sphere along normal
            const diff = this.sphere.position.subtract(worldPos)
            this.projectedDragDistance = Vector3.Dot(diff, normalWorld)
        })
        
    }

    private sendSync() {
        console.log('sending sync for point pair', this.id)
        this.syncManager.pointPairsMap.set(this.id, {
            id: this.id,
            pos: { x: this.sphere.position.x, y: this.sphere.position.y, z: this.sphere.position.z },
        })
    }
    
    // Public helper: set sphere position programmatically and update projected marker
    public setSpherePosition(newPos: Vector3, skipSync: boolean = false) {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        this.ignoreSphere = true
        // In planar mode we want free 3D dragging (do not constrain to sphere)
        if (getProjectionMode() === ProjectionMode.Planar) {
            this.sphere.position = newPos
        } else {
            this.sphere.position = projectOntoSphere(newPos, bigRadius)
        }
        
        // compute lat/lon and update projected marker without triggering its handler
        // recompute projected position based on current projection mode
        this.updateProjectedFromSphere()
        
        this.ignoreSphere = false

        if (!skipSync) {
            this.sendSync()
        }
    }

    // Update this.projected.position from current sphere position depending on projection mode
    private updateProjectedFromSphere() {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        const mode = getProjectionMode()
        const p = this.sphere.position.clone().normalize()
        const lat = Math.asin(p.y)
        const lon = Math.atan2(p.z, p.x)
        if (mode === ProjectionMode.Spherical) {
            const { nx, ny } = equirectangularNormalizedXY(lat, lon)
            this.ignoreProjected = true
            this.projected.position.x = nx * (planeWidth / 2)
            this.projected.position.y = ny * (planeHeight / 2)
            this.ignoreProjected = false
        } else {
            // Planar: orthographic projection onto the plane's X/Y local coordinates
            // Compute world position of sphere and then transform to plane-local
            const worldPos = this.sphere.position
            // plane is parent of projected, so transform worldPos into plane local by using plane.getWorldMatrix().invert()
            const inv = this.opts.plane.getWorldMatrix().clone()
            inv.invert()
            const local = Vector3.TransformCoordinates(worldPos, inv)
            this.ignoreProjected = true
            this.projected.position.x = local.x
            this.projected.position.y = local.y
            this.ignoreProjected = false
        }
    }
    
    // Public helper: set projected (local plane) position and update sphere accordingly
    public setProjectedLocalPosition(localPos: Vector3, skipSync: boolean = false) {
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

        // If in planar projection mode and we have a stored drag distance, copy the 2D world translation to the 3D point
        if (getProjectionMode() === ProjectionMode.Planar && this.projectedDragDistance !== null) {
            // world position of the projected local
            const worldPos = Vector3.TransformCoordinates(new Vector3(clampedX, clampedY, 0), this.opts.plane.getWorldMatrix())
            // plane normal in world space
            const normal = Vector3.TransformNormal(new Vector3(0, 0, 1), this.opts.plane.getWorldMatrix()).normalize()
            // position the sphere at worldPos + normal * storedDistance
            const desired = worldPos.add(normal.scale(this.projectedDragDistance))
            this.ignoreSphere = true
            this.sphere.position = desired
            this.ignoreSphere = false
        } else {
            // default spherical mapping behavior (or when no stored drag distance)
            this.ignoreSphere = true
            const globePos = latLonToVec3(lat, lon, bigRadius)
            this.sphere.position = globePos
            this.ignoreSphere = false
        }

        if (!skipSync) {
            this.sendSync()
        }
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
