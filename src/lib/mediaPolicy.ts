import type { MediaType } from '../types/media'

export const RECOMMENDED_SIGNAGE_VIDEO_PROFILE = 'MP4 + H.264/AVC + AAC estereo, 1080p, 30 fps y bitrate moderado'

export function getMediaCompatibilityWarnings(input: {
    name: string
    mimeType: string
    type: MediaType
}) {
    if (input.type !== 'video') {
        return []
    }

    if (input.mimeType === 'video/mp4') {
        return []
    }

    return [{
        code: 'RECOMMENDED_VIDEO_FORMAT' as const,
        message: `${input.name}: formato detectado ${input.mimeType || 'desconocido'}. Para Smart TV se recomienda ${RECOMMENDED_SIGNAGE_VIDEO_PROFILE}.`,
        itemId: null,
    }]
}