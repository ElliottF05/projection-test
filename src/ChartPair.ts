import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { Chart, CHART_SCALE_FACTOR, ChartKind } from './charts'
import { equirectangularNormalizedXY, inverseEquirectangularNormalizedXY, latLonToVec3, projectOntoSphere, ProjectionMode, onProjectionModeChange, getProjectionMode } from './projection'

export interface ChartPairOptions {
    id?: string
    scene: Scene
    bigRadius: number
    plane: Mesh
    planeWidth: number
    planeHeight: number
    chartKind: ChartKind
    initialLat?: number
    initialLon?: number
    color?: Color3
    collisionRadius3D?: number
    collisionRadius2D?: number
}

export class ChartPair {
    public readonly id: string
    public chart3D: Chart
    public chart2D: Chart
    public radius3D: number
    public radius2D: number
    public collisionVis3D: Mesh
    public collisionVis2D: Mesh
    public isDragging: boolean = false

    private opts: ChartPairOptions
    private ignore3D = false
    private ignore2D = false
    private projectedDragDistance: number | null = null
    private static _nextId = 1

    constructor(opts: ChartPairOptions) {
        this.opts = opts
        const { scene, bigRadius } = opts

        const generatedId = `chartpair_${ChartPair._nextId++}`
        this.id = opts.id ?? generatedId

        // create charts: primary chart and a fresh copy for the projection
        const kind = opts.chartKind
        this.chart3D = new Chart(kind, scene)
        this.chart2D = new Chart(kind, scene)

        // scale charts
        this.chart3D.scale(CHART_SCALE_FACTOR)
        this.chart2D.scale(CHART_SCALE_FACTOR)

        const defaultRadius = 0.2 * bigRadius
        this.radius3D = opts.collisionRadius3D ?? defaultRadius
        this.radius2D = opts.collisionRadius2D ?? defaultRadius

        // collision visuals
        this.collisionVis3D = MeshBuilder.CreateSphere(this.id + '_col3d', { diameter: this.radius3D * 2 }, scene)
        const col3Mat = new StandardMaterial(this.id + '_col3d_mat', scene)
        col3Mat.diffuseColor = new Color3(1, 0, 0)
        col3Mat.alpha = 0.25
        this.collisionVis3D.material = col3Mat

        // leave collision visuals unparented; we will position them to match the charts
        this.collisionVis3D.isVisible = false
        this.collisionVis3D.isPickable = false

        this.collisionVis2D = MeshBuilder.CreateSphere(this.id + '_col2d', { diameter: this.radius2D * 2 }, scene)
        const col2Mat = new StandardMaterial(this.id + '_col2d_mat', scene)
        col2Mat.diffuseColor = new Color3(1, 0, 0)
        col2Mat.alpha = 0.25
        this.collisionVis2D.material = col2Mat

        // leave unparented; we'll position by world coords
        this.collisionVis2D.isVisible = false
        this.collisionVis2D.isPickable = false

        // initial placement using charts directly
        if (typeof opts.initialLat === 'number' && typeof opts.initialLon === 'number') {
            const v = latLonToVec3(opts.initialLat, opts.initialLon, bigRadius)
            this.chart3D.setPosition(v)
            this.updateProjectedFrom3D()
        } else {
            this.chart3D.setPosition(new Vector3(bigRadius, 0, 0))
            this.updateProjectedFrom3D()
        }

        // temp: rotate 2d vis
        this.chart2D.setRotation(new Vector3(0, Math.PI / 2, 0))
        this.chart2D.setPosition(this.chart2D.getPosition().subtract(new Vector3(0.05, 0, 0)))

        // sync chart visuals and wire behaviors
        this.setupBehaviors()

        // respond to projection mode changes
        onProjectionModeChange(() => this.updateProjectedFrom3D())
    }

    private setupBehaviors() {
        const pb3 = this.chart3D._positionBehavior
        pb3.onDragStartObservable.add(() => { this.isDragging = true })
        pb3.onDragEndObservable.add(() => { this.isDragging = false })
        pb3.onPositionChangedObservable.add(() => {
            if (this.ignore3D) return
            const pos = this.chart3D.getPosition()
            this.setSpherePosition(pos)
        })
        pb3.detachCameraControls = true

        const pb2 = this.chart2D._positionBehavior
        pb2.onDragStartObservable.add(() => { this.isDragging = true })
        pb2.onDragEndObservable.add(() => { this.isDragging = false; this.projectedDragDistance = null })
        pb2.onPositionChangedObservable.add(() => {
            if (this.ignore2D) return
            const worldPos = this.chart2D.getPosition()
            const inv = this.opts.plane.getWorldMatrix().clone()
            inv.invert()
            const localPos = Vector3.TransformCoordinates(worldPos, inv)
            this.setProjectedLocalPosition(localPos)
        })
        pb2.detachCameraControls = true
        // when 2D drag starts, record current distance from plane along its normal
        pb2.onDragStartObservable.add(() => {
            if (getProjectionMode() !== ProjectionMode.Planar) return
            const worldPos = this.chart2D.getPosition()
            const inv = this.opts.plane.getWorldMatrix().clone()
            inv.invert()
            const local = Vector3.TransformCoordinates(worldPos, inv)
            // plane normal in world space
            const normal = Vector3.TransformNormal(new Vector3(0,0,1), this.opts.plane.getWorldMatrix()).normalize()
            const diff = this.chart3D.getPosition().subtract(worldPos)
            this.projectedDragDistance = Vector3.Dot(diff, normal)
        })
    }

    public setSpherePosition(newPos: Vector3) {
        const { bigRadius, planeWidth, planeHeight, plane } = this.opts
        this.ignore3D = true
        const proj = projectOntoSphere(newPos, bigRadius)
        this.chart3D.setPosition(proj)
        // update the projected 2D chart according to current projection mode
        this.updateProjectedFrom3D()
        // ensure we clear the 3D ignore flag
        this.ignore3D = false
    }

    private updateProjectedFrom3D() {
        const { plane, planeWidth, planeHeight } = this.opts
        const mode = getProjectionMode()
        const worldPos = this.chart3D.getPosition()
        if (mode === ProjectionMode.Spherical) {
            const p = worldPos.clone().normalize()
            const lat = Math.asin(p.y)
            const lon = Math.atan2(p.z, p.x)
            const { nx, ny } = equirectangularNormalizedXY(lat, lon)
            const local2 = new Vector3(nx * (planeWidth / 2), ny * (planeHeight / 2), 0)
            const world2 = Vector3.TransformCoordinates(local2, plane.getWorldMatrix())
            // temp offset
            world2.x -= 0.05
            this.ignore2D = true
            this.chart2D.setPosition(world2)
            this.chart2D.setRotation(new Vector3(0, Math.PI / 2, 0))
            this.ignore2D = false
        } else {
            // Planar orthographic: transform worldPos into plane-local coords then clamp and transform back
            const inv = plane.getWorldMatrix().clone()
            inv.invert()
            const local = Vector3.TransformCoordinates(worldPos, inv)
            const halfW = planeWidth / 2
            const halfH = planeHeight / 2
            local.x = Math.max(-halfW, Math.min(halfW, local.x))
            local.y = Math.max(-halfH, Math.min(halfH, local.y))
            const world2 = Vector3.TransformCoordinates(local, plane.getWorldMatrix())
            // temp offset
            world2.x -= 0.05
            this.ignore2D = true
            this.chart2D.setPosition(world2)
            this.chart2D.setRotation(new Vector3(0, Math.PI / 2, 0))
            this.ignore2D = false
        }
    }

    public setProjectedLocalPosition(localPos: Vector3) {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        const clampedX = Math.min(Math.max(localPos.x, -planeWidth / 2), planeWidth / 2)
        const clampedY = Math.min(Math.max(localPos.y, -planeHeight / 2), planeHeight / 2)

        this.ignore2D = true
        const worldPos = Vector3.TransformCoordinates(new Vector3(clampedX, clampedY, 0), this.opts.plane.getWorldMatrix())
        
        // temp offset:
        worldPos.x -= 0.1

        this.chart2D.setPosition(worldPos)
        this.chart2D.setRotation(new Vector3(0, Math.PI / 2, 0))
        this.ignore2D = false

        const nx = clampedX / (planeWidth / 2)
        const ny = clampedY / (planeHeight / 2)
        // If in planar mode and we have a stored drag distance, position the 3D chart by copying world translation and preserving distance along plane normal
        if (getProjectionMode() === ProjectionMode.Planar && this.projectedDragDistance !== null) {
            const world = Vector3.TransformCoordinates(new Vector3(clampedX, clampedY, 0), this.opts.plane.getWorldMatrix())
            // plane normal in world space
            const normal = Vector3.TransformNormal(new Vector3(0,0,1), this.opts.plane.getWorldMatrix()).normalize()
            const desired = world.add(normal.scale(this.projectedDragDistance))
            this.ignore3D = true
            this.chart3D.setPosition(desired)
            this.ignore3D = false
            return
        }

        const { lat, lon } = inverseEquirectangularNormalizedXY(nx, ny)

        this.ignore3D = true
        this.chart3D.setPosition(latLonToVec3(lat, lon, bigRadius))
        this.ignore3D = false
    }

    public showCollision3D(visible: boolean) {
        if (!this.collisionVis3D) return
        this.collisionVis3D.isVisible = visible
    }

    public showCollision2D(visible: boolean) {
        if (!this.collisionVis2D) return
        const pos = (this.chart2D as any).getPosition()
        if (pos) this.collisionVis2D.position = pos.clone()
        this.collisionVis2D.isVisible = visible
    }
}
