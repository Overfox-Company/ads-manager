import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ensureMediaItemVariants } from '../src/lib/media'
import {
    getPrimaryProfileForVariant,
    inferSupportedProfiles,
} from '../src/lib/playbackProfiles'
import type { MediaItem, MediaVariant, Orientation, PlaybackProfileId, PlaybackStatus } from '../src/types/media'
import type { PlaybackTelemetryReport, PlayerIssueReason, SharedPlaybackState } from '../src/types/network'
import { resolveStorageRelativePath } from './mediaStorage'

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

function isPlaybackProfile(value: unknown): value is PlaybackProfileId {
    return (
        value === 'compatibility' ||
        value === 'balanced' ||
        value === 'native' ||
        value === 'modern-efficiency' ||
        value === 'modern-quality' ||
        value === 'av1-experimental'
    )
}

function isOrientation(value: unknown): value is Orientation {
    return (
        value === 'horizontal' ||
        value === 'vertical' ||
        value === 'horizontal-inverted' ||
        value === 'vertical-inverted'
    )
}

function sanitizeVariant(variant: unknown): MediaVariant | null {
    if (!variant || typeof variant !== 'object') {
        return null
    }

    const candidate = variant as Record<string, unknown>

    if (
        typeof candidate.id !== 'string' ||
        typeof candidate.storageId !== 'string' ||
        typeof candidate.label !== 'string' ||
        !Array.isArray(candidate.supportedProfiles) ||
        !isPlaybackProfile(candidate.profile) ||
        typeof candidate.mimeType !== 'string' ||
        typeof candidate.isMaster !== 'boolean'
    ) {
        return null
    }

    const supportedProfiles = candidate.supportedProfiles.filter((profile): profile is PlaybackProfileId =>
        isPlaybackProfile(profile),
    )
    const videoCodec = candidate.videoCodec === 'h264' || candidate.videoCodec === 'hevc' || candidate.videoCodec === 'av1'
        ? candidate.videoCodec
        : 'unknown'
    const fps = typeof candidate.fps === 'number' ? candidate.fps : null
    const width = typeof candidate.width === 'number' ? candidate.width : null
    const normalizedSupportedProfiles = supportedProfiles.length > 0
        ? inferSupportedProfiles(candidate.profile, videoCodec, width, fps)
        : inferSupportedProfiles(null, videoCodec, width, fps)
    const normalizedProfile = getPrimaryProfileForVariant(normalizedSupportedProfiles)

    return {
        id: candidate.id,
        storageId: candidate.storageId,
        label: candidate.label,
        profile: normalizedProfile,
        supportedProfiles: normalizedSupportedProfiles,
        container: candidate.container === 'mp4' || candidate.container === 'webm' ? candidate.container : 'unknown',
        videoCodec,
        audioCodec: candidate.audioCodec === 'aac' || candidate.audioCodec === 'opus' ? candidate.audioCodec : 'unknown',
        width,
        height: typeof candidate.height === 'number' ? candidate.height : null,
        fps,
        bitrateKbps: typeof candidate.bitrateKbps === 'number' ? candidate.bitrateKbps : null,
        mimeType: candidate.mimeType,
        isMaster: candidate.isMaster,
    }
}

function sanitizePlaylist(playlist: unknown): MediaItem[] {
    if (!Array.isArray(playlist)) {
        return []
    }

    return playlist.flatMap((item) => {
        if (!item || typeof item !== 'object') {
            return []
        }

        const candidate = item as Record<string, unknown>

        if (
            typeof candidate.id !== 'string' ||
            typeof candidate.name !== 'string' ||
            (candidate.type !== 'image' && candidate.type !== 'video') ||
            typeof candidate.mimeType !== 'string' ||
            typeof candidate.size !== 'number' ||
            typeof candidate.createdAt !== 'number' ||
            (candidate.durationOverrideSeconds !== null && typeof candidate.durationOverrideSeconds !== 'number') ||
            (candidate.naturalDurationSeconds !== null && typeof candidate.naturalDurationSeconds !== 'number')
        ) {
            return []
        }

        const variants = Array.isArray(candidate.variants)
            ? candidate.variants.map((variant) => sanitizeVariant(variant)).filter((variant): variant is MediaVariant => Boolean(variant))
            : []

        return [ensureMediaItemVariants({
            id: candidate.id,
            storageId: typeof candidate.storageId === 'string' ? candidate.storageId : candidate.id,
            name: candidate.name,
            type: candidate.type,
            mimeType: candidate.mimeType,
            size: candidate.size,
            createdAt: candidate.createdAt,
            durationOverrideSeconds: candidate.durationOverrideSeconds ?? null,
            naturalDurationSeconds: candidate.naturalDurationSeconds ?? null,
            variants,
        })]
    })
}

function sanitizePlaybackReport(input: unknown): PlaybackTelemetryReport | null {
    if (!input || typeof input !== 'object') {
        return null
    }

    const candidate = input as Record<string, unknown>

    if (!isPlaybackProfile(candidate.requestedProfile)) {
        return null
    }

    return {
        screenId: typeof candidate.screenId === 'string' ? candidate.screenId : null,
        itemId: typeof candidate.itemId === 'string' ? candidate.itemId : null,
        requestedProfile: candidate.requestedProfile,
        resolvedProfile: isPlaybackProfile(candidate.resolvedProfile) ? candidate.resolvedProfile : null,
        variantId: typeof candidate.variantId === 'string' ? candidate.variantId : null,
        variantLabel: typeof candidate.variantLabel === 'string' ? candidate.variantLabel : null,
        videoCodec:
            candidate.videoCodec === 'h264' || candidate.videoCodec === 'hevc' || candidate.videoCodec === 'av1'
                ? candidate.videoCodec
                : null,
        audioCodec: candidate.audioCodec === 'aac' || candidate.audioCodec === 'opus' ? candidate.audioCodec : null,
        container: candidate.container === 'mp4' || candidate.container === 'webm' ? candidate.container : null,
        width: typeof candidate.width === 'number' ? candidate.width : null,
        height: typeof candidate.height === 'number' ? candidate.height : null,
        fps: typeof candidate.fps === 'number' ? candidate.fps : null,
        bitrateKbps: typeof candidate.bitrateKbps === 'number' ? candidate.bitrateKbps : null,
        didFallback: Boolean(candidate.didFallback),
        reason: typeof candidate.reason === 'string' ? candidate.reason : null,
        updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
    }
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
        playbackProfile: 'native',
        generateVariantsOnUpload: false,
        lastPlaybackReport: sanitizePlaybackReport(input?.lastPlaybackReport),
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

function isIndexInRange(index: number, playlistLength: number) {
    if (playlistLength === 0) {
        return index === 0
    }

    return index >= 0 && index < playlistLength
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
        return path.join(mediaDirectory, resolveStorageRelativePath(id))
    }

    findItem(id: string) {
        return this.state.playlist.find((item) => item.id === id) ?? null
    }

    findStorageOwner(storageId: string) {
        for (const item of this.state.playlist) {
            if (item.storageId === storageId) {
                return item
            }

            if (item.variants.some((variant) => variant.storageId === storageId)) {
                return item
            }
        }

        return null
    }

    async appendUploads(entries: Array<{ item: MediaItem; files: Array<{ storageId: string; fileBuffer?: Buffer; filePath?: string }> }>) {
        if (entries.length === 0) {
            return this.state
        }

        for (const entry of entries) {
            for (const file of entry.files) {
                await mkdir(path.dirname(this.getMediaPath(file.storageId)), { recursive: true })

                if (file.filePath) {
                    await copyFile(file.filePath, this.getMediaPath(file.storageId))
                    continue
                }

                if (file.fileBuffer) {
                    await writeFile(this.getMediaPath(file.storageId), file.fileBuffer)
                }
            }
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
        const removedItem = this.findItem(id)

        this.state = stampState(nextState)
        await this.persist()

        const storageIds = new Set<string>()

        if (removedItem) {
            storageIds.add(removedItem.storageId)

            for (const variant of removedItem.variants) {
                storageIds.add(variant.storageId)
            }
        } else {
            storageIds.add(id)
        }

        for (const storageId of storageIds) {
            await rm(this.getMediaPath(storageId), { force: true })
        }

        if (removedItem) {
            await rm(path.join(mediaDirectory, removedItem.id), { recursive: true, force: true })
        }

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

    async setPlaybackProfile(_playbackProfile: PlaybackProfileId) {
        this.state = stampState({
            ...this.state,
            playbackProfile: 'native',
        })
        await this.persist()

        return this.state
    }

    async setGenerateVariantsOnUpload(_enabled: boolean) {
        this.state = stampState({
            ...this.state,
            generateVariantsOnUpload: false,
        })
        await this.persist()

        return this.state
    }

    async setPlaybackReport(report: PlaybackTelemetryReport, expectedVersion?: number | null) {
        if (typeof expectedVersion === 'number' && expectedVersion !== this.state.updatedAt) {
            return this.state
        }

        this.state = {
            ...this.state,
            lastPlaybackReport: {
                ...report,
                updatedAt: Date.now(),
            },
        }
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

    async advanceFromPlayer(expectedItemId: string | null, expectedVersion?: number | null) {
        if (this.state.playlist.length === 0 || this.state.status !== 'playing') {
            return this.state
        }

        if (!this.matchesExpectedPlayback(expectedItemId, expectedVersion)) {
            return this.state
        }

        this.state = stampState(
            normalizeState({
                ...this.state,
                currentIndex: (this.state.currentIndex + 1) % this.state.playlist.length,
                status: 'playing',
            }),
        )
        await this.persist()

        return this.state
    }

    async reportPlayerIssue(
        expectedItemId: string | null,
        expectedVersion: number | null | undefined,
        reason: PlayerIssueReason,
    ) {
        if (reason === 'load-timeout' || reason === 'media-error' || reason === 'unsupported') {
            if (this.state.playlist.length <= 1) {
                if (!this.matchesExpectedPlayback(expectedItemId, expectedVersion)) {
                    return this.state
                }

                this.state = stampState({
                    ...this.state,
                    status: 'stopped',
                })
                await this.persist()

                return this.state
            }

            return this.advanceFromPlayer(expectedItemId, expectedVersion)
        }

        return this.state
    }

    async repairCurrentIndex() {
        const normalizedIndex = clampIndex(this.state.currentIndex, this.state.playlist.length)

        if (normalizedIndex === this.state.currentIndex && isIndexInRange(this.state.currentIndex, this.state.playlist.length)) {
            return this.state
        }

        this.state = stampState(
            normalizeState({
                ...this.state,
                currentIndex: normalizedIndex,
            }),
        )
        await this.persist()

        return this.state
    }

    private matchesExpectedPlayback(expectedItemId: string | null, expectedVersion?: number | null) {
        if (typeof expectedVersion === 'number' && expectedVersion !== this.state.updatedAt) {
            return false
        }

        if (!expectedItemId) {
            return true
        }

        return getCurrentItemId(this.state) === expectedItemId
    }

    private async persist() {
        await mkdir(dataDirectory, { recursive: true })
        await writeFile(stateFilePath, JSON.stringify(this.state, null, 2), 'utf8')
    }
}