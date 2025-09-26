import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { Chart, CHART_SCALE_FACTOR, ChartKind } from './charts'
import { equirectangularNormalizedXY, inverseEquirectangularNormalizedXY, latLonToVec3, projectOntoSphere } from './projection'

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
            const { nx, ny } = equirectangularNormalizedXY(opts.initialLat, opts.initialLon)
            const local2 = new Vector3(nx * (opts.planeWidth / 2), ny * (opts.planeHeight / 2), 0)
            const world2 = Vector3.TransformCoordinates(local2, opts.plane.getWorldMatrix())
            this.chart2D.setPosition(world2)
        } else {
            this.chart3D.setPosition(new Vector3(bigRadius, 0, 0))
            const { nx, ny } = equirectangularNormalizedXY(0, 0)
            const local2 = new Vector3(nx * (opts.planeWidth / 2), ny * (opts.planeHeight / 2), 0)
            const world2 = Vector3.TransformCoordinates(local2, opts.plane.getWorldMatrix())
            this.chart2D.setPosition(world2)
        }

        // sync chart visuals and wire behaviors
        this.setupBehaviors()
    }

    private setupBehaviors() {
        const pb3 = this.chart3D._positionBehavior
        pb3.onDragStartObservable.add(() => { this.isDragging = true })
        pb3.onDragEndObservable.add(() => { this.isDragging = false })
        pb3.onPositionChangedObservable.add(() => {
            // console.log('3D position changed')
            // if (this.ignore3D) return
            const pos = this.chart3D.getPosition()
            this.setSpherePosition(pos)
        })

        const pb2 = this.chart2D._positionBehavior
        pb2.onDragStartObservable.add(() => { this.isDragging = true })
        pb2.onDragEndObservable.add(() => { this.isDragging = false })
        pb2.onPositionChangedObservable.add(() => {
            // console.log('2D position changed')
            // if (this.ignore2D) return
            const worldPos = this.chart2D.getPosition()
            const inv = this.opts.plane.getWorldMatrix().clone()
            inv.invert()
            const localPos = Vector3.TransformCoordinates(worldPos, inv)
            this.setProjectedLocalPosition(localPos)
        })
    }

    public setSpherePosition(newPos: Vector3) {
        const { bigRadius, planeWidth, planeHeight, plane } = this.opts
        this.ignore3D = true
        const proj = projectOntoSphere(newPos, bigRadius)
        this.chart3D.setPosition(proj)

        const p = proj.clone().normalize()
        const lat = Math.asin(p.y)
        const lon = Math.atan2(p.z, p.x)
        const { nx, ny } = equirectangularNormalizedXY(lat, lon)

        this.ignore2D = true
        // compute plane-local pos then transform to world before setting the 2D chart
        const local2 = new Vector3(nx * (planeWidth / 2), ny * (planeHeight / 2), 0)
        const world2 = Vector3.TransformCoordinates(local2, plane.getWorldMatrix())
        this.chart2D.setPosition(world2)
        this.ignore2D = false
        // ensure we clear the 3D ignore flag
        this.ignore3D = false
    }

    public setProjectedLocalPosition(localPos: Vector3) {
        const { bigRadius, planeWidth, planeHeight } = this.opts
        const clampedX = Math.min(Math.max(localPos.x, -planeWidth / 2), planeWidth / 2)
        const clampedY = Math.min(Math.max(localPos.y, -planeHeight / 2), planeHeight / 2)

        this.ignore2D = true
        const worldPos = Vector3.TransformCoordinates(new Vector3(clampedX, clampedY, 0), this.opts.plane.getWorldMatrix())
        this.chart2D.setPosition(worldPos)
        this.ignore2D = false

        const nx = clampedX / (planeWidth / 2)
        const ny = clampedY / (planeHeight / 2)
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
