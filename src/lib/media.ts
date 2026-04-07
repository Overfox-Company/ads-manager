import {
    getDisplayAssetName,
    inferFrameRateHintFromName,
    inferAudioCodecHint,
    inferContainerHint,
    inferPlaybackProfileHintFromName,
    inferVideoCodecHint,
    getVariantGroupKey,
    normalizeSelectablePlaybackProfile,
} from './playbackProfiles'
import type {
    MediaItem,
    MediaType,
    Orientation,
    PlaybackStatus,
    UploadMediaDescriptor,
} from '../types/media'

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

async function readVideoMetadata(blob: Blob) {
    type VideoMetadataProbe = {
        preload: string
        onloadedmetadata: (() => void) | null
        onerror: (() => void) | null
        removeAttribute: (name: string) => void
        load: () => void
        src: string
        duration: number
        videoWidth: number
        videoHeight: number
    }

    const documentRef = (globalThis as {
        document?: {
            createElement: (tagName: string) => VideoMetadataProbe
        }
    }).document

    if (!documentRef) {
        return { duration: null, width: null, height: null }
    }

    return new Promise<{ duration: number | null; width: number | null; height: number | null }>((resolve) => {
        const video = documentRef.createElement('video')
        const objectUrl = URL.createObjectURL(blob)

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl)
            video.removeAttribute('src')
            video.load()
        }

        video.preload = 'metadata'
        video.onloadedmetadata = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : null
            const width = Number.isFinite(video.videoWidth) && video.videoWidth > 0 ? video.videoWidth : null
            const height = Number.isFinite(video.videoHeight) && video.videoHeight > 0 ? video.videoHeight : null
            cleanup()
            resolve({ duration, width, height })
        }

        video.onerror = () => {
            cleanup()
            resolve({ duration: null, width: null, height: null })
        }

        video.src = objectUrl
    })
}

export async function createUploadMediaDescriptorFromFile(
    file: File,
    id: string,
    createdAt = Date.now(),
) {
    const type = resolveMediaType(file.type)

    if (!type) {
        return null
    }

    const videoMetadata = type === 'video'
        ? await readVideoMetadata(file)
        : { duration: null, width: null, height: null }
    const variantProfileHint = type === 'video' ? inferPlaybackProfileHintFromName(file.name) : null
    const videoCodecHint = type === 'video' ? inferVideoCodecHint(file.name, file.type) : 'unknown'
    const audioCodecHint = type === 'video' ? inferAudioCodecHint(file.type, file.name) : 'unknown'
    const containerHint = type === 'video' ? inferContainerHint(file.type, file.name) : 'unknown'
    const fpsHint = type === 'video' ? inferFrameRateHintFromName(file.name) : null
    const bitrateKbps = type === 'video' && videoMetadata.duration && videoMetadata.duration > 0
        ? Math.round((file.size * 8) / 1000 / videoMetadata.duration)
        : null

    return {
        id,
        name: getDisplayAssetName(file.name),
        type,
        mimeType: file.type,
        size: file.size,
        createdAt,
        naturalDurationSeconds: videoMetadata.duration,
        width: videoMetadata.width,
        height: videoMetadata.height,
        fps: fpsHint,
        bitrateKbps,
        variantGroupKey: type === 'video' ? getVariantGroupKey(file.name) : null,
        variantProfileHint,
        videoCodecHint,
        audioCodecHint,
        containerHint,
    } satisfies UploadMediaDescriptor
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

export function getPreviewStorageId(item: MediaItem) {
    if (item.type === 'image') {
        return item.storageId
    }

    const nativeVariant = item.variants.find((variant) =>
        variant.supportedProfiles.includes('native') || variant.profile === 'native',
    )

    return nativeVariant?.storageId ?? item.storageId ?? item.variants[0]?.storageId
}

export function ensureMediaItemVariants(item: MediaItem): MediaItem {
    if (item.type !== 'video') {
        return {
            ...item,
            storageId: item.storageId || item.id,
            variants: [],
        }
    }

    if (item.variants.length > 0) {
        const nativeVariant = item.variants.find((variant) =>
            variant.supportedProfiles.includes('native') || variant.profile === 'native',
        )

        return {
            ...item,
            storageId: nativeVariant?.storageId || item.storageId || item.variants[0]?.storageId || item.id,
        }
    }

    return {
        ...item,
        storageId: item.storageId || item.id,
        variants: [{
            id: `${item.id}-source`,
            storageId: item.storageId || item.id,
            label: 'Nativa',
            profile: normalizeSelectablePlaybackProfile('native'),
            supportedProfiles: ['native'],
            container: inferContainerHint(item.mimeType, item.name),
            videoCodec: inferVideoCodecHint(item.name, item.mimeType),
            audioCodec: inferAudioCodecHint(item.mimeType, item.name),
            width: null,
            height: null,
            fps: null,
            bitrateKbps: null,
            mimeType: item.mimeType,
            isMaster: true,
        }],
    }
}