import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import express from 'express'
import multer from 'multer'
import WebSocket, { WebSocketServer } from 'ws'
import { ensureMediaItemVariants } from '../src/lib/media'
import { getMediaCompatibilityWarnings } from '../src/lib/mediaPolicy'
import type { MediaItem, MediaType, MediaVariant, Orientation, UploadMediaDescriptor } from '../src/types/media'
import type {
    DurationOverrideRequest,
    ImageDurationRequest,
    OrientationRequest,
    PlaybackActionRequest,
    PlayerPlaybackReportRequest,
    PlayerAdvanceRequest,
    PlayerIssueRequest,
    PlayerManifest,
    PlaylistCurrentIndexRequest,
    PlaylistReorderRequest,
    PlaylistSelectionRequest,
    ServerSocketMessage,
    StateResponse,
} from '../src/types/network'
import { StateRepository } from './stateRepository'
import { createNativeStorageId } from './mediaStorage'
import { cleanupPreparedPaths } from './videoVariantPipeline'

const HOST = '0.0.0.0'
const PORT = Number(process.env.PORT ?? '8787')
const uploadTempDirectory = path.resolve(process.cwd(), 'local-data', 'uploads-temp')
const upload = multer({
    storage: multer.diskStorage({
        destination: (_request, _file, callback) => {
            callback(null, uploadTempDirectory)
        },
        filename: (_request, file, callback) => {
            const extension = path.extname(file.originalname)

            callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`)
        },
    }),
})
const repository = new StateRepository()

function resolveMediaType(mimeType: string): MediaType | null {
    if (mimeType.startsWith('image/')) {
        return 'image'
    }

    if (mimeType.startsWith('video/')) {
        return 'video'
    }

    return null
}

function sendState(response: express.Response<StateResponse>, state = repository.getState()) {
    return response.json({ state })
}

function sendError(response: express.Response, status: number, error: string) {
    return response.status(status).json({ error })
}

function getRequestOrigin(request: express.Request) {
    const host = request.get('host') ?? `localhost:${PORT}`
    return `${request.protocol}://${host}`
}

function buildPlaylistId(items: MediaItem[]) {
    return items.length === 0 ? 'empty' : items.map((item) => item.id).join('|')
}

function createFallbackOriginalVariant(assetId: string, descriptor: UploadMediaDescriptor, storageId: string) {
    return {
        id: `${assetId}:${storageId}`,
        storageId,
        label: 'Nativa',
        profile: 'native',
        supportedProfiles: ['native'],
        container: descriptor.containerHint,
        videoCodec: descriptor.videoCodecHint,
        audioCodec: descriptor.audioCodecHint,
        width: descriptor.width,
        height: descriptor.height,
        fps: descriptor.fps,
        bitrateKbps: descriptor.bitrateKbps,
        mimeType: descriptor.mimeType,
        isMaster: true,
    } satisfies MediaVariant
}

function getNativeVariants(item: MediaItem) {
    if (item.type !== 'video') {
        return []
    }

    const nativeVariants = item.variants.filter((variant) =>
        variant.profile === 'native' || variant.supportedProfiles.includes('native'),
    )

    return nativeVariants.length > 0 ? nativeVariants : item.variants.slice(0, 1)
}

async function buildUploadAssets(entries: Array<{ descriptor: UploadMediaDescriptor; filePath: string }>) {
    const cleanupPaths: string[] = []

    const assets: Array<{ item: MediaItem; files: Array<{ storageId: string; filePath: string }> }> = []

    for (const entry of entries) {
        cleanupPaths.push(entry.filePath)
        const firstDescriptor = entry.descriptor

        if (!firstDescriptor) {
            throw new Error('Grupo de uploads invalido')
        }

        if (firstDescriptor.type === 'image') {
            assets.push({
                item: ensureMediaItemVariants({
                    id: firstDescriptor.id,
                    storageId: firstDescriptor.id,
                    name: firstDescriptor.name,
                    type: 'image',
                    mimeType: firstDescriptor.mimeType,
                    size: firstDescriptor.size,
                    createdAt: firstDescriptor.createdAt,
                    durationOverrideSeconds: null,
                    naturalDurationSeconds: null,
                    variants: [],
                }),
                files: [{ storageId: firstDescriptor.id, filePath: entry.filePath }],
            })

            continue
        }

        // La generacion automatica de variantes se desactivo: todos los uploads de video
        // conservan unicamente la version nativa para almacenamiento y reproduccion.

        const assetId = firstDescriptor.id
        const nativeStorageId = createNativeStorageId(assetId, path.extname(entry.filePath) || '.mp4')
        const variants = [createFallbackOriginalVariant(assetId, firstDescriptor, nativeStorageId)]

        assets.push({
            item: ensureMediaItemVariants({
                id: assetId,
                storageId: nativeStorageId,
                name: firstDescriptor.name,
                type: 'video',
                mimeType: firstDescriptor.mimeType,
                size: firstDescriptor.size,
                createdAt: firstDescriptor.createdAt,
                durationOverrideSeconds: null,
                naturalDurationSeconds: firstDescriptor.naturalDurationSeconds,
                variants,
            }),
            files: [{
                storageId: nativeStorageId,
                filePath: entry.filePath,
            }],
        })
    }

    return { assets, cleanupPaths }
}

function buildPlayerManifest(request: express.Request, state = repository.getState()) {
    const origin = getRequestOrigin(request)

    return {
        playlistId: buildPlaylistId(state.playlist),
        version: state.updatedAt,
        status: state.status,
        isPlaying: state.status === 'playing',
        isPaused: state.status === 'paused',
        currentIndex: state.currentIndex,
        currentItemId: state.playlist[state.currentIndex]?.id ?? null,
        orientation: state.orientation,
        imageDurationSeconds: state.imageDurationSeconds,
        playbackProfile: 'native',
        lastPlaybackReport: state.lastPlaybackReport,
        updatedAt: state.updatedAt,
        items: state.playlist.map((item) => {
            const nativeVariants = getNativeVariants(item)
            const playbackStorageId = item.type === 'video'
                ? nativeVariants[0]?.storageId ?? item.storageId
                : item.storageId

            return {
                id: item.id,
                storageId: playbackStorageId,
                name: item.name,
                type: item.type,
                src: new URL(`/api/media/${playbackStorageId}/content`, `${origin}/`).toString(),
                mime: item.mimeType,
                duration: item.type === 'image'
                    ? item.durationOverrideSeconds ?? state.imageDurationSeconds
                    : item.naturalDurationSeconds,
                variants: item.type === 'video'
                    ? nativeVariants.map((variant) => ({
                        ...variant,
                        src: new URL(`/api/media/${variant.storageId}/content`, `${origin}/`).toString(),
                    }))
                    : [],
            }
        }),
    } satisfies PlayerManifest
}

function sendPlayerManifest(
    request: express.Request,
    response: express.Response<{ manifest: PlayerManifest }>,
    state = repository.getState(),
) {
    return response.json({ manifest: buildPlayerManifest(request, state) })
}

function broadcastState(server: WebSocketServer) {
    const message = JSON.stringify({
        type: 'STATE_SYNC',
        state: repository.getState(),
    } satisfies ServerSocketMessage)

    for (const client of server.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message)
        }
    }
}

async function maybeEnableStaticHosting(app: express.Express) {
    const distDirectory = path.resolve(process.cwd(), 'dist')

    try {
        await access(distDirectory)
    } catch {
        return
    }

    app.use(express.static(distDirectory))
    app.get(/^(?!\/api|\/ws).*/, (_request, response) => {
        response.sendFile(path.join(distDirectory, 'index.html'))
    })
}

async function main() {
    await mkdir(uploadTempDirectory, { recursive: true })
    await repository.initialize()

    const app = express()
    app.set('trust proxy', true)
    const httpServer = http.createServer(app)
    const websocketServer = new WebSocketServer({ server: httpServer, path: '/ws' })

    websocketServer.on('connection', (socket) => {
        socket.send(
            JSON.stringify({
                type: 'STATE_SYNC',
                state: repository.getState(),
            } satisfies ServerSocketMessage),
        )
    })

    app.use(express.json({ limit: '2mb' }))
    app.use((request, response, next) => {
        const origin = request.headers.origin

        response.header('Access-Control-Allow-Origin', origin ?? '*')
        response.header('Vary', 'Origin')
        response.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
        response.header('Access-Control-Allow-Headers', 'Content-Type')

        if (request.method === 'OPTIONS') {
            response.sendStatus(204)
            return
        }

        next()
    })

    app.get('/api/state', (_request, response) => {
        sendState(response)
    })

    app.get('/api/player/manifest', async (request, response) => {
        const state = await repository.repairCurrentIndex()

        return sendPlayerManifest(request, response, state)
    })

    app.post('/api/media/upload', upload.array('files'), async (request, response) => {
        const files = (request.files ?? []) as Express.Multer.File[]
        const metadataRaw = request.body.metadata

        if (files.length === 0 || typeof metadataRaw !== 'string') {
            return sendError(response, 400, 'Debes enviar archivos y metadata valida')
        }

        let metadata: UploadMediaDescriptor[]

        try {
            const parsed = JSON.parse(metadataRaw) as unknown

            if (!Array.isArray(parsed)) {
                return sendError(response, 400, 'La metadata del upload debe ser una lista')
            }

            metadata = parsed as UploadMediaDescriptor[]
        } catch {
            return sendError(response, 400, 'No se pudo interpretar la metadata del upload')
        }

        if (metadata.length !== files.length) {
            return sendError(response, 400, 'La cantidad de archivos no coincide con la metadata enviada')
        }

        const entries = metadata.flatMap((item, index) => {
            const file = files[index]

            if (!file) {
                return []
            }

            const type = resolveMediaType(file.mimetype)

            if (!type || item.id !== String(item.id)) {
                return []
            }

            return [{
                descriptor: {
                    ...item,
                    name: item.name || file.originalname,
                    type,
                    mimeType: file.mimetype,
                    size: file.size,
                },
                filePath: file.path,
            }]
        })

        const { assets: uploadAssets, cleanupPaths } = await buildUploadAssets(entries)

        try {
            const state = await repository.appendUploads(uploadAssets)
            const warnings = uploadAssets.flatMap(({ item }) =>
                getMediaCompatibilityWarnings(item).map((warning) => ({
                    ...warning,
                    itemId: item.id,
                })),
            )

            broadcastState(websocketServer)
            return response.json({ state, warnings } satisfies StateResponse)
        } finally {
            await cleanupPreparedPaths(cleanupPaths)
        }
    })

    app.get('/api/media/:id/content', (request, response) => {
        const item = repository.findStorageOwner(request.params.id)

        if (!item) {
            return sendError(response, 404, 'No existe el medio solicitado')
        }

        const variant = item.variants.find((candidate) => candidate.storageId === request.params.id) ?? null

        response.type(variant?.mimeType ?? item.mimeType)
        return response.sendFile(repository.getMediaPath(request.params.id))
    })

    app.delete('/api/media/:id', async (request, response) => {
        const state = await repository.removeItem(request.params.id)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/playlist/reorder', async (request, response) => {
        const body = request.body as PlaylistReorderRequest

        if (!body || !Array.isArray(body.orderedIds)) {
            return sendError(response, 400, 'orderedIds es requerido')
        }

        try {
            const state = await repository.reorderPlaylist(body.orderedIds)

            broadcastState(websocketServer)
            return sendState(response, state)
        } catch (error) {
            return sendError(response, 400, error instanceof Error ? error.message : 'No se pudo reordenar la playlist')
        }
    })

    app.post('/api/playlist/select', async (request, response) => {
        const body = request.body as PlaylistSelectionRequest
        const state = await repository.selectItem(body?.selectedItemId ?? null)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/playlist/current', async (request, response) => {
        const body = request.body as PlaylistCurrentIndexRequest

        if (!body || typeof body.index !== 'number') {
            return sendError(response, 400, 'index es requerido')
        }

        const state = await repository.setCurrentIndex(body.index)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/settings/orientation', async (request, response) => {
        const body = request.body as OrientationRequest

        if (!body || typeof body.orientation !== 'string') {
            return sendError(response, 400, 'orientation es requerida')
        }

        const state = await repository.setOrientation(body.orientation as Orientation)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/settings/image-duration', async (request, response) => {
        const body = request.body as ImageDurationRequest

        if (!body || typeof body.seconds !== 'number') {
            return sendError(response, 400, 'seconds es requerido')
        }

        const state = await repository.setImageDuration(body.seconds)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/settings/playback-profile', async (_request, response) => {
        // Endpoint conservado por compatibilidad. La app queda bloqueada en perfil nativo.
        const state = await repository.setPlaybackProfile('native')

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/settings/upload-variants', async (_request, response) => {
        // Endpoint conservado por compatibilidad. La generacion de variantes queda desactivada.
        const state = await repository.setGenerateVariantsOnUpload(false)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/playlist/duration-override', async (request, response) => {
        const body = request.body as DurationOverrideRequest

        if (!body || typeof body.id !== 'string') {
            return sendError(response, 400, 'id es requerido')
        }

        const state = await repository.setDurationOverride(body.id, body.seconds ?? null)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/playback', async (request, response) => {
        const body = request.body as PlaybackActionRequest

        if (!body || (body.action !== 'play' && body.action !== 'pause' && body.action !== 'stop' && body.action !== 'next' && body.action !== 'previous')) {
            return sendError(response, 400, 'action invalida')
        }

        const state = await repository.applyPlaybackAction(body.action, body.index)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    app.post('/api/player/advance', async (request, response) => {
        const body = request.body as PlayerAdvanceRequest

        if (
            !body ||
            typeof body.expectedVersion !== 'number' ||
            (body.reason !== 'completed' && body.reason !== 'image-timeout')
        ) {
            return sendError(response, 400, 'Payload invalido para avanzar reproduccion')
        }

        const state = await repository.advanceFromPlayer(body.expectedItemId ?? null, body.expectedVersion)

        broadcastState(websocketServer)
        return sendPlayerManifest(request, response, state)
    })

    app.post('/api/player/issues', async (request, response) => {
        const body = request.body as PlayerIssueRequest

        if (
            !body ||
            typeof body.expectedVersion !== 'number' ||
            (body.reason !== 'load-timeout' && body.reason !== 'media-error' && body.reason !== 'unsupported')
        ) {
            return sendError(response, 400, 'Payload invalido para reportar error del player')
        }

        console.warn(
            `[player${body.screenId ? `:${body.screenId}` : ''}] ${body.reason} item=${body.itemId ?? 'n/a'}${body.detail ? ` detail=${body.detail}` : ''}`,
        )

        const state = await repository.reportPlayerIssue(body.itemId ?? null, body.expectedVersion, body.reason)

        broadcastState(websocketServer)
        return sendPlayerManifest(request, response, state)
    })

    app.post('/api/player/playback-report', async (request, response) => {
        const body = request.body as PlayerPlaybackReportRequest

        if (!body || typeof body.expectedVersion !== 'number') {
            return sendError(response, 400, 'Payload invalido para reportar reproduccion')
        }

        const state = await repository.setPlaybackReport({
            screenId: body.screenId ?? null,
            itemId: body.itemId ?? null,
            requestedProfile: body.requestedProfile,
            resolvedProfile: body.resolvedProfile ?? null,
            variantId: body.variantId ?? null,
            variantLabel: body.variantLabel ?? null,
            videoCodec: body.videoCodec ?? null,
            audioCodec: body.audioCodec ?? null,
            container: body.container ?? null,
            width: body.width ?? null,
            height: body.height ?? null,
            fps: body.fps ?? null,
            bitrateKbps: body.bitrateKbps ?? null,
            didFallback: body.didFallback,
            reason: body.reason ?? null,
            updatedAt: Date.now(),
        }, body.expectedVersion)

        broadcastState(websocketServer)
        return sendState(response, state)
    })

    await maybeEnableStaticHosting(app)

    httpServer.listen(PORT, HOST, () => {
        console.log(`LAN server listening on http://${HOST}:${PORT}`)
    })
}

void main().catch((error) => {
    console.error(error)
    process.exit(1)
})