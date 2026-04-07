import { create } from 'zustand'
import { getMediaBlob, saveMediaBlob } from '../lib/indexedDb'
import { getMediaContentUrl } from '../lib/serverApi'
import { DEFAULT_IMAGE_DURATION_SECONDS, ensureMediaItemVariants, getPreviewStorageId } from '../lib/media'
import type { MediaItem, Orientation, PlaybackProfileId, PlaybackStatus } from '../types/media'
import type { PlaybackTelemetryReport, SharedPlaybackState } from '../types/network'

type PlaylistStore = {
    playlist: MediaItem[]
    mediaUrls: Record<string, string>
    currentIndex: number
    selectedItemId: string | null
    status: PlaybackStatus
    orientation: Orientation
    imageDurationSeconds: number
    playbackProfile: PlaybackProfileId
    generateVariantsOnUpload: boolean
    lastPlaybackReport: PlaybackTelemetryReport | null
    lastCommandAt: number
    updatedAt: number
    hydrateRemoteState: (state: SharedPlaybackState) => void
    ensureMediaUrls: () => Promise<void>
}

const MAX_IMAGE_DURATION_SECONDS = 300
const MIN_IMAGE_DURATION_SECONDS = 3
const pendingMediaCacheIds = new Set<string>()

function clampImageDuration(seconds: number) {
    if (!Number.isFinite(seconds)) {
        return DEFAULT_IMAGE_DURATION_SECONDS
    }

    return Math.min(MAX_IMAGE_DURATION_SECONDS, Math.max(MIN_IMAGE_DURATION_SECONDS, Math.round(seconds)))
}

function revokeObjectUrl(url: string | undefined) {
    if (!url || !url.startsWith('blob:')) {
        return
    }

    URL.revokeObjectURL(url)
}

async function cacheRemoteMedia(item: MediaItem) {
    if (pendingMediaCacheIds.has(item.id)) {
        return
    }

    pendingMediaCacheIds.add(item.id)

    try {
        const response = await fetch(getMediaContentUrl(getPreviewStorageId(item)))

        if (!response.ok) {
            return
        }

        const blob = await response.blob()

        await saveMediaBlob({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
            size: item.size,
            createdAt: item.createdAt,
            blob,
        })
    } catch (error) {
        console.error(error)
    } finally {
        pendingMediaCacheIds.delete(item.id)
    }
}

function normalizeReferences(
    playlist: MediaItem[],
    desiredIndex: number,
    selectedItemId: string | null,
) {
    if (playlist.length === 0) {
        return {
            currentIndex: 0,
            selectedItemId: null,
        }
    }

    const selectedId =
        selectedItemId && playlist.some((item) => item.id === selectedItemId)
            ? selectedItemId
            : playlist[0]?.id ?? null

    return {
        currentIndex: Math.min(Math.max(desiredIndex, 0), playlist.length - 1),
        selectedItemId: selectedId,
    }
}

export const usePlaylistStore = create<PlaylistStore>()(
    (set, get) => ({
        playlist: [],
        mediaUrls: {},
        currentIndex: 0,
        selectedItemId: null,
        status: 'stopped',
        orientation: 'horizontal',
        imageDurationSeconds: DEFAULT_IMAGE_DURATION_SECONDS,
        playbackProfile: 'native',
        generateVariantsOnUpload: false,
        lastPlaybackReport: null,
        lastCommandAt: 0,
        updatedAt: 0,
        hydrateRemoteState: (remoteState) => {
            set((state) => {
                const normalizedPlaylist = remoteState.playlist.map((item) => ensureMediaItemVariants(item))
                const normalized = normalizeReferences(
                    normalizedPlaylist,
                    remoteState.currentIndex,
                    remoteState.selectedItemId,
                )
                const nextMediaUrls = { ...state.mediaUrls }

                for (const [id, url] of Object.entries(nextMediaUrls)) {
                    if (!normalizedPlaylist.some((item) => item.id === id)) {
                        revokeObjectUrl(url)
                        delete nextMediaUrls[id]
                    }
                }

                return {
                    playlist: normalizedPlaylist,
                    mediaUrls: nextMediaUrls,
                    currentIndex: normalized.currentIndex,
                    selectedItemId: normalized.selectedItemId,
                    status: normalizedPlaylist.length === 0 ? 'stopped' : remoteState.status,
                    orientation: remoteState.orientation,
                    imageDurationSeconds: clampImageDuration(remoteState.imageDurationSeconds),
                    playbackProfile: 'native',
                    generateVariantsOnUpload: false,
                    lastPlaybackReport: remoteState.lastPlaybackReport,
                    lastCommandAt: remoteState.lastCommandAt,
                    updatedAt: remoteState.updatedAt,
                }
            })
        },
        ensureMediaUrls: async () => {
            const state = get()
            const desiredIds = new Set(state.playlist.map((item) => item.id))
            const loadedUrls: Record<string, string> = {}

            for (const item of state.playlist) {
                if (state.mediaUrls[item.id]) {
                    continue
                }

                const blob = await getMediaBlob(item.id)

                if (!blob) {
                    loadedUrls[item.id] = getMediaContentUrl(getPreviewStorageId(item))
                    void cacheRemoteMedia(item)
                    continue
                }

                loadedUrls[item.id] = URL.createObjectURL(blob)
            }

            set((currentState) => {
                const nextMediaUrls = { ...currentState.mediaUrls }

                for (const [id, url] of Object.entries(nextMediaUrls)) {
                    if (!desiredIds.has(id)) {
                        revokeObjectUrl(url)
                        delete nextMediaUrls[id]
                    }
                }

                for (const [id, url] of Object.entries(loadedUrls)) {
                    if (nextMediaUrls[id]) {
                        revokeObjectUrl(url)
                        continue
                    }

                    nextMediaUrls[id] = url
                }

                return { mediaUrls: nextMediaUrls }
            })
        },
    }),
)