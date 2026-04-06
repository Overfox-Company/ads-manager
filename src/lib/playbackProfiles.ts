import type { AudioCodec, PlaybackProfileId, VideoCodec, VideoContainer } from '../types/media'

export interface PlaybackProfileDefinition {
    id: PlaybackProfileId
    label: string
    shortLabel: string
    description: string
    technicalSummary: string
    compatibilityLabel: string
    compatibilityWarning: string | null
    badge: 'recommended' | 'safe' | 'modern' | 'premium' | 'experimental'
    isDefault: boolean
}

export const DEFAULT_PLAYBACK_PROFILE: PlaybackProfileId = 'balanced'

export const PLAYBACK_PROFILE_DEFINITIONS: PlaybackProfileDefinition[] = [
    {
        id: 'compatibility',
        label: 'Compatibilidad maxima',
        shortLabel: 'Compatibilidad',
        description: 'H.264 / AAC · 720p-1080p · Estable para TVs modestos y navegadores embebidos.',
        technicalSummary: 'MP4 · H.264 / AVC · AAC estereo · 30 fps · prioridad en estabilidad.',
        compatibilityLabel: 'Esperada alta',
        compatibilityWarning: null,
        badge: 'safe',
        isDefault: false,
    },
    {
        id: 'balanced',
        label: 'Balanceado',
        shortLabel: 'Balanceado',
        description: 'H.264 / AAC · 1080p · Mejor equilibrio entre calidad general y estabilidad.',
        technicalSummary: 'MP4 · H.264 / AVC · AAC estereo · 1080p · 30 fps base.',
        compatibilityLabel: 'Esperada media-alta',
        compatibilityWarning: null,
        badge: 'recommended',
        isDefault: true,
    },
    {
        id: 'modern-efficiency',
        label: 'Eficiencia moderna',
        shortLabel: 'Eficiencia',
        description: 'H.265 / AAC · 1080p · Mejor compresion para hardware reciente.',
        technicalSummary: 'MP4 · H.265 / HEVC · AAC estereo · 1080p · admite 60/120 fps si la variante lo soporta.',
        compatibilityLabel: 'Esperada media',
        compatibilityWarning: 'Puede degradar a H.264 en TVs viejos o decodificacion limitada.',
        badge: 'modern',
        isDefault: false,
    },
    {
        id: 'modern-quality',
        label: 'Alta calidad moderna',
        shortLabel: 'Alta calidad',
        description: 'H.265 / AAC · alta fidelidad · Pensado para hardware reciente y validado, incluyendo variantes HFR.',
        technicalSummary: 'MP4 · H.265 / HEVC · bitrate alto moderado · hasta 120 fps si hardware y variante lo permiten.',
        compatibilityLabel: 'Esperada media-baja',
        compatibilityWarning: 'No usar como default en TVs no validados; prioriza fidelidad sobre compatibilidad.',
        badge: 'premium',
        isDefault: false,
    },
    {
        id: 'av1-experimental',
        label: 'Experimental AV1',
        shortLabel: 'AV1 experimental',
        description: 'AV1 · uso restringido · Solo para dispositivos realmente compatibles.',
        technicalSummary: 'AV1 · no asumir soporte en Smart TV sin validacion fuerte.',
        compatibilityLabel: 'Esperada baja',
        compatibilityWarning: 'Experimental. Si no hay soporte real, el sistema baja automaticamente a perfiles seguros.',
        badge: 'experimental',
        isDefault: false,
    },
]

export const PLAYBACK_PROFILE_FALLBACKS: Record<PlaybackProfileId, PlaybackProfileId[]> = {
    compatibility: ['compatibility'],
    balanced: ['balanced', 'compatibility'],
    'modern-efficiency': ['modern-efficiency', 'balanced', 'compatibility'],
    'modern-quality': ['modern-quality', 'modern-efficiency', 'balanced', 'compatibility'],
    'av1-experimental': ['av1-experimental', 'modern-efficiency', 'balanced', 'compatibility'],
}

const PROFILE_NAME_SUFFIXES: Array<{ pattern: RegExp; profile: PlaybackProfileId }> = [
    { pattern: /(?:__|--)(compat|compatibility|max-compat|safe)$/i, profile: 'compatibility' },
    { pattern: /(?:__|--)(balanced|balanceado|default|general)$/i, profile: 'balanced' },
    { pattern: /(?:__|--)(modern|efficiency|hevc|modern-hevc)$/i, profile: 'modern-efficiency' },
    { pattern: /(?:__|--)(premium|quality|hq|modern-quality)$/i, profile: 'modern-quality' },
    { pattern: /(?:__|--)(av1|experimental-av1|av1-experimental)$/i, profile: 'av1-experimental' },
]

function stripExtension(fileName: string) {
    return fileName.replace(/\.[^.]+$/, '')
}

export function getPlaybackProfileDefinition(profile: PlaybackProfileId) {
    return PLAYBACK_PROFILE_DEFINITIONS.find((definition) => definition.id === profile)
        ?? PLAYBACK_PROFILE_DEFINITIONS[0]
}

export function getPlaybackProfileFallbackChain(profile: PlaybackProfileId) {
    return PLAYBACK_PROFILE_FALLBACKS[profile]
}

export function inferPlaybackProfileHintFromName(fileName: string) {
    const stem = stripExtension(fileName)

    for (const entry of PROFILE_NAME_SUFFIXES) {
        if (entry.pattern.test(stem)) {
            return entry.profile
        }
    }

    return null
}

export function getVariantGroupKey(fileName: string) {
    const stem = stripExtension(fileName)
    const matchedProfile = PROFILE_NAME_SUFFIXES.find((entry) => entry.pattern.test(stem))

    if (!matchedProfile) {
        return null
    }

    return stem.replace(matchedProfile.pattern, '')
}

export function getDisplayAssetName(fileName: string) {
    const stem = stripExtension(fileName)
    const matchedProfile = PROFILE_NAME_SUFFIXES.find((entry) => entry.pattern.test(stem))

    return matchedProfile ? stem.replace(matchedProfile.pattern, '') : stem
}

export function inferVideoCodecHint(fileName: string, mimeType: string): VideoCodec {
    const normalized = fileName.toLowerCase()

    if (normalized.includes('av1')) {
        return 'av1'
    }

    if (normalized.includes('hevc') || normalized.includes('h265') || normalized.includes('x265')) {
        return 'hevc'
    }

    if (normalized.includes('h264') || normalized.includes('avc')) {
        return 'h264'
    }

    if (mimeType === 'video/mp4') {
        return 'h264'
    }

    return 'unknown'
}

export function inferAudioCodecHint(mimeType: string, fileName: string): AudioCodec {
    const normalized = fileName.toLowerCase()

    if (normalized.includes('opus')) {
        return 'opus'
    }

    if (mimeType === 'video/mp4' || normalized.includes('aac')) {
        return 'aac'
    }

    if (mimeType === 'video/webm') {
        return 'opus'
    }

    return 'unknown'
}

export function inferContainerHint(mimeType: string, fileName: string): VideoContainer {
    if (mimeType === 'video/mp4' || fileName.toLowerCase().endsWith('.mp4')) {
        return 'mp4'
    }

    if (mimeType === 'video/webm' || fileName.toLowerCase().endsWith('.webm')) {
        return 'webm'
    }

    return 'unknown'
}

export function inferFrameRateHintFromName(fileName: string) {
    const normalized = fileName.toLowerCase()
    const matched = normalized.match(/(?:^|[^0-9])((?:23\.976|24|25|29\.97|30|48|50|59\.94|60|90|100|120))\s*(?:fps|hz)(?:[^0-9]|$)/i)

    if (!matched) {
        return null
    }

    const parsed = Number(matched[1])

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function inferSupportedProfiles(
    explicitProfile: PlaybackProfileId | null,
    videoCodec: VideoCodec,
    width: number | null,
): PlaybackProfileId[] {
    if (explicitProfile === 'compatibility') {
        return ['compatibility']
    }

    if (explicitProfile === 'balanced') {
        return ['balanced', 'compatibility']
    }

    if (explicitProfile === 'modern-efficiency') {
        return ['modern-efficiency']
    }

    if (explicitProfile === 'modern-quality') {
        return ['modern-quality', 'modern-efficiency']
    }

    if (explicitProfile === 'av1-experimental') {
        return ['av1-experimental']
    }

    if (videoCodec === 'hevc') {
        return width && width >= 1920
            ? ['modern-quality', 'modern-efficiency']
            : ['modern-efficiency']
    }

    if (videoCodec === 'av1') {
        return ['av1-experimental']
    }

    if (videoCodec === 'h264') {
        return width && width >= 1920
            ? ['balanced', 'compatibility']
            : ['compatibility']
    }

    return ['compatibility']
}

export function getPrimaryProfileForVariant(supportedProfiles: PlaybackProfileId[]) {
    return supportedProfiles[0] ?? 'compatibility'
}