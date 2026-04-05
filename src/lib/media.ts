import type { MediaItem, MediaType, Orientation, PlaybackStatus } from '../types/media'

export const ORIENTATION_OPTIONS: Array<{ value: Orientation; label: string }> = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal-inverted', label: 'Horizontal invertido' },
    { value: 'vertical-inverted', label: 'Vertical invertido' },
]

export const PLAYBACK_STATUS_LABELS: Record<PlaybackStatus, string> = {
    playing: 'Reproduciendo',
    paused: 'Pausado',
    stopped: 'Detenido',
}

export const DEFAULT_IMAGE_DURATION_SECONDS = 10

export function resolveMediaType(mimeType: string): MediaType | null {
    if (mimeType.startsWith('image/')) {
        return 'image'
    }

    if (mimeType.startsWith('video/')) {
        return 'video'
    }

    return null
}

export async function readVideoDuration(blob: Blob) {
    return new Promise<number | null>((resolve) => {
        const video = document.createElement('video')
        const objectUrl = URL.createObjectURL(blob)

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl)
            video.removeAttribute('src')
            video.load()
        }

        video.preload = 'metadata'
        video.onloadedmetadata = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : null
            cleanup()
            resolve(duration)
        }

        video.onerror = () => {
            cleanup()
            resolve(null)
        }

        video.src = objectUrl
    })
}

export async function createMediaItemFromFile(
    file: File,
    id: string,
    createdAt = Date.now(),
) {
    const type = resolveMediaType(file.type)

    if (!type) {
        return null
    }

    return {
        id,
        name: file.name,
        type,
        mimeType: file.type,
        size: file.size,
        createdAt,
        durationOverrideSeconds: null,
        naturalDurationSeconds: type === 'video' ? await readVideoDuration(file) : null,
    } satisfies MediaItem
}

export function getDisplayDurationSeconds(
    item: MediaItem,
    imageDurationSeconds: number,
) {
    if (item.type === 'video') {
        return item.naturalDurationSeconds
    }

    return item.durationOverrideSeconds ?? imageDurationSeconds
}