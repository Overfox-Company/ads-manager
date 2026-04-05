import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MediaItem, Orientation, PlaybackStatus } from '../src/types/media'
import type { SharedPlaybackState } from '../src/types/network'

const DEFAULT_IMAGE_DURATION_SECONDS = 10
const MIN_IMAGE_DURATION_SECONDS = 3
const MAX_IMAGE_DURATION_SECONDS = 300

const dataDirectory = path.resolve(process.cwd(), 'local-data')
const mediaDirectory = path.join(dataDirectory, 'media')
const stateFilePath = path.join(dataDirectory, 'state.json')

function clampIndex(index: number, playlistLength: number) {
    if (playlistLength === 0) {
        return 0
    }

    return Math.min(Math.max(index, 0), playlistLength - 1)
}

function clampImageDuration(seconds: number) {
    if (!Number.isFinite(seconds)) {
        return DEFAULT_IMAGE_DURATION_SECONDS
    }

    return Math.min(MAX_IMAGE_DURATION_SECONDS, Math.max(MIN_IMAGE_DURATION_SECONDS, Math.round(seconds)))
}

function isPlaybackStatus(value: unknown): value is PlaybackStatus {
    return value === 'playing' || value === 'paused' || value === 'stopped'
}

function isOrientation(value: unknown): value is Orientation {
    return (
        value === 'horizontal' ||
        value === 'vertical' ||
        value === 'horizontal-inverted' ||
        value === 'vertical-inverted'
    )
}

function sanitizePlaylist(playlist: unknown): MediaItem[] {
    if (!Array.isArray(playlist)) {
        return []
    }

    return playlist.filter((item): item is MediaItem => {
        if (!item || typeof item !== 'object') {
            return false
        }

        const candidate = item as Record<string, unknown>

        return (
            typeof candidate.id === 'string' &&
            typeof candidate.name === 'string' &&
            (candidate.type === 'image' || candidate.type === 'video') &&
            typeof candidate.mimeType === 'string' &&
            typeof candidate.size === 'number' &&
            typeof candidate.createdAt === 'number' &&
            (candidate.durationOverrideSeconds === null || typeof candidate.durationOverrideSeconds === 'number') &&
            (candidate.naturalDurationSeconds === null || typeof candidate.naturalDurationSeconds === 'number')
        )
    })
}

function normalizeState(input: Partial<SharedPlaybackState> | null | undefined): SharedPlaybackState {
    const playlist = sanitizePlaylist(input?.playlist)
    const selectedItemId =
        typeof input?.selectedItemId === 'string' && playlist.some((item) => item.id === input.selectedItemId)
            ? input.selectedItemId
            : playlist[0]?.id ?? null

    return {
        playlist,
        currentIndex: clampIndex(typeof input?.currentIndex === 'number' ? input.currentIndex : 0, playlist.length),
        selectedItemId,
        status: playlist.length === 0 ? 'stopped' : isPlaybackStatus(input?.status) ? input.status : 'stopped',
        orientation: isOrientation(input?.orientation) ? input.orientation : 'horizontal',
        imageDurationSeconds: clampImageDuration(
            typeof input?.imageDurationSeconds === 'number'
                ? input.imageDurationSeconds
                : DEFAULT_IMAGE_DURATION_SECONDS,
        ),
        lastCommandAt: typeof input?.lastCommandAt === 'number' ? input.lastCommandAt : 0,
        updatedAt: typeof input?.updatedAt === 'number' ? input.updatedAt : Date.now(),
    }
}

function stampState(state: SharedPlaybackState) {
    const now = Date.now()

    return {
        ...state,
        lastCommandAt: now,
        updatedAt: now,
    }
}

function getCurrentItemId(state: SharedPlaybackState) {
    return state.playlist[state.currentIndex]?.id ?? null
}

export class StateRepository {
    private state: SharedPlaybackState = normalizeState(undefined)

    async initialize() {
        await mkdir(mediaDirectory, { recursive: true })

        try {
            await access(stateFilePath)
            const raw = await readFile(stateFilePath, 'utf8')
            const parsed = JSON.parse(raw) as Partial<SharedPlaybackState>

            this.state = normalizeState(parsed)
        } catch {
            this.state = normalizeState(undefined)
            await this.persist()
        }
    }

    getState() {
        return this.state
    }

    getMediaPath(id: string) {
        return path.join(mediaDirectory, id)
    }

    findItem(id: string) {
        return this.state.playlist.find((item) => item.id === id) ?? null
    }

    async appendUploads(entries: Array<{ item: MediaItem; fileBuffer: Buffer }>) {
        if (entries.length === 0) {
            return this.state
        }

        for (const entry of entries) {
            await writeFile(this.getMediaPath(entry.item.id), entry.fileBuffer)
        }

        const playlist = [...this.state.playlist, ...entries.map((entry) => entry.item)]
        const nextState = normalizeState({
            ...this.state,
            playlist,
            selectedItemId: this.state.selectedItemId ?? entries[0]?.item.id ?? null,
        })

        this.state = stampState(nextState)
        await this.persist()

        return this.state
    }

    async removeItem(id: string) {
        const currentItemId = getCurrentItemId(this.state)
        const nextPlaylist = this.state.playlist.filter((item) => item.id !== id)
        const nextCurrentIndex = currentItemId && currentItemId !== id
            ? nextPlaylist.findIndex((item) => item.id === currentItemId)
            : this.state.currentIndex
        const nextState = normalizeState({
            ...this.state,
            playlist: nextPlaylist,
            currentIndex: nextCurrentIndex,
            selectedItemId: this.state.selectedItemId === id ? null : this.state.selectedItemId,
            status: nextPlaylist.length === 0 ? 'stopped' : this.state.status,
        })

        this.state = stampState(nextState)
        await this.persist()
        await rm(this.getMediaPath(id), { force: true })

        return this.state
    }

    async reorderPlaylist(orderedIds: string[]) {
        const currentIds = this.state.playlist.map((item) => item.id)
        const currentIdSet = new Set(currentIds)

        if (orderedIds.length !== currentIds.length || orderedIds.some((id) => !currentIdSet.has(id))) {
            throw new Error('El orden recibido no coincide con la playlist actual')
        }

        const itemById = new Map(this.state.playlist.map((item) => [item.id, item]))
        const currentItemId = getCurrentItemId(this.state)
        const nextPlaylist = orderedIds.map((id) => itemById.get(id)).filter((item): item is MediaItem => Boolean(item))
        const nextCurrentIndex = currentItemId ? nextPlaylist.findIndex((item) => item.id === currentItemId) : this.state.currentIndex

        this.state = stampState(
            normalizeState({
                ...this.state,
                playlist: nextPlaylist,
                currentIndex: nextCurrentIndex,
            }),
        )
        await this.persist()

        return this.state
    }

    async selectItem(selectedItemId: string | null) {
        this.state = stampState(
            normalizeState({
                ...this.state,
                selectedItemId,
            }),
        )
        await this.persist()

        return this.state
    }

    async setCurrentIndex(index: number) {
        this.state = stampState(
            normalizeState({
                ...this.state,
                currentIndex: index,
            }),
        )
        await this.persist()

        return this.state
    }

    async setOrientation(orientation: Orientation) {
        this.state = stampState(
            normalizeState({
                ...this.state,
                orientation,
            }),
        )
        await this.persist()

        return this.state
    }

    async setImageDuration(seconds: number) {
        this.state = stampState({
            ...this.state,
            imageDurationSeconds: clampImageDuration(seconds),
        })
        await this.persist()

        return this.state
    }

    async setDurationOverride(id: string, seconds: number | null) {
        this.state = stampState({
            ...this.state,
            playlist: this.state.playlist.map((item) => {
                if (item.id !== id || item.type !== 'image') {
                    return item
                }

                return {
                    ...item,
                    durationOverrideSeconds: seconds === null ? null : clampImageDuration(seconds),
                }
            }),
        })
        await this.persist()

        return this.state
    }

    async applyPlaybackAction(action: 'play' | 'pause' | 'stop' | 'next' | 'previous', index?: number) {
        if (this.state.playlist.length === 0) {
            this.state = stampState({
                ...this.state,
                status: 'stopped',
            })
            await this.persist()

            return this.state
        }

        switch (action) {
            case 'play':
                this.state = stampState(
                    normalizeState({
                        ...this.state,
                        currentIndex: typeof index === 'number' ? index : this.state.currentIndex,
                        status: 'playing',
                    }),
                )
                break
            case 'pause':
                this.state = stampState({
                    ...this.state,
                    status: this.state.status === 'stopped' ? 'stopped' : 'paused',
                })
                break
            case 'stop':
                this.state = stampState({
                    ...this.state,
                    status: 'stopped',
                })
                break
            case 'next':
                this.state = stampState({
                    ...this.state,
                    currentIndex: (this.state.currentIndex + 1) % this.state.playlist.length,
                })
                break
            case 'previous':
                this.state = stampState({
                    ...this.state,
                    currentIndex: (this.state.currentIndex - 1 + this.state.playlist.length) % this.state.playlist.length,
                })
                break
        }

        await this.persist()

        return this.state
    }

    private async persist() {
        await mkdir(dataDirectory, { recursive: true })
        await writeFile(stateFilePath, JSON.stringify(this.state, null, 2), 'utf8')
    }
}