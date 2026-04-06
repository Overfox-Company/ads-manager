import { getPlaybackProfileDefinition, getPlaybackProfileFallbackChain } from '../lib/playbackProfiles'
import type { PlaybackProfileId } from '../types/media'
import type { PlayerManifestItem, PlayerManifestVariant } from '../types/network'

export interface DevicePlaybackCapabilities {
    userAgent: string
    isWhale: boolean
    isSmartTv: boolean
    supportsMp4: boolean
    supportsH264: boolean
    supportsHevc: boolean
    supportsAv1: boolean
    supportsWebm: boolean
}

export interface ResolvedPlaybackDecision {
    requestedProfile: PlaybackProfileId
    resolvedProfile: PlaybackProfileId | null
    variant: PlayerManifestVariant | null
    didFallback: boolean
    reason: string | null
}

function probeType(video: HTMLVideoElement, mime: string) {
    try {
        return video.canPlayType(mime)
    } catch {
        return ''
    }
}

function getCodecProbeStrings(variant: PlayerManifestVariant) {
    if (variant.container === 'mp4' && variant.videoCodec === 'h264') {
        return ['video/mp4; codecs="avc1.42E01E, mp4a.40.2"', 'video/mp4']
    }

    if (variant.container === 'mp4' && variant.videoCodec === 'hevc') {
        return [
            'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"',
            'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"',
            'video/mp4',
        ]
    }

    if (variant.container === 'mp4' && variant.videoCodec === 'av1') {
        return ['video/mp4; codecs="av01.0.05M.08, mp4a.40.2"', 'video/mp4']
    }

    if (variant.container === 'webm') {
        return ['video/webm', variant.mimeType]
    }

    return [variant.mimeType, variant.container === 'mp4' ? 'video/mp4' : 'video/webm']
}

function rankProbeResult(result: string) {
    if (result === 'probably') {
        return 3
    }

    if (result === 'maybe') {
        return 2
    }

    return 0
}

function getVariantSupportScore(variant: PlayerManifestVariant, capabilities: DevicePlaybackCapabilities) {
    if (variant.videoCodec === 'h264' && capabilities.supportsH264) {
        return 3
    }

    if (variant.videoCodec === 'hevc' && capabilities.supportsHevc) {
        return 3
    }

    if (variant.videoCodec === 'av1' && capabilities.supportsAv1) {
        return 3
    }

    if (variant.container === 'webm' && capabilities.supportsWebm) {
        return 2
    }

    if (variant.container === 'mp4' && capabilities.supportsMp4) {
        return variant.videoCodec === 'unknown' ? 2 : 1
    }

    return 0
}

function buildFallbackReason(
    requestedProfile: PlaybackProfileId,
    resolvedProfile: PlaybackProfileId,
    variant: PlayerManifestVariant,
) {
    const requested = getPlaybackProfileDefinition(requestedProfile)
    const resolved = getPlaybackProfileDefinition(resolvedProfile)

    if (requestedProfile === 'av1-experimental' && resolvedProfile !== requestedProfile) {
        return `El perfil AV1 experimental no esta disponible en esta pantalla. Se uso ${resolved.label}.`
    }

    if ((requestedProfile === 'modern-efficiency' || requestedProfile === 'modern-quality') && variant.videoCodec !== 'hevc') {
        return `Este dispositivo no soporta HEVC de forma fiable. Se uso ${resolved.label}.`
    }

    if (requestedProfile !== resolvedProfile) {
        return `El perfil ${requested.shortLabel.toLowerCase()} no estaba disponible para este contenido. Se uso ${resolved.label}.`
    }

    return null
}

export function detectDevicePlaybackCapabilities(): DevicePlaybackCapabilities {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const normalizedUa = userAgent.toLowerCase()
    const video = typeof document !== 'undefined' ? document.createElement('video') : null

    if (!video) {
        return {
            userAgent,
            isWhale: false,
            isSmartTv: false,
            supportsMp4: false,
            supportsH264: false,
            supportsHevc: false,
            supportsAv1: false,
            supportsWebm: false,
        }
    }

    return {
        userAgent,
        isWhale: normalizedUa.includes('whale'),
        isSmartTv: normalizedUa.includes('smart-tv') || normalizedUa.includes('smarttv') || normalizedUa.includes('web0s') || normalizedUa.includes('tizen') || normalizedUa.includes('whale'),
        supportsMp4: rankProbeResult(probeType(video, 'video/mp4')) > 0,
        supportsH264: rankProbeResult(probeType(video, 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) > 0,
        supportsHevc: Math.max(
            rankProbeResult(probeType(video, 'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"')),
            rankProbeResult(probeType(video, 'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"')),
        ) > 0,
        supportsAv1: rankProbeResult(probeType(video, 'video/mp4; codecs="av01.0.05M.08, mp4a.40.2"')) > 0,
        supportsWebm: rankProbeResult(probeType(video, 'video/webm')) > 0,
    }
}

export function resolvePlaybackVariant(
    item: PlayerManifestItem,
    requestedProfile: PlaybackProfileId,
    capabilities: DevicePlaybackCapabilities,
    attemptedVariantIds: string[] = [],
): ResolvedPlaybackDecision {
    if (item.type !== 'video') {
        return {
            requestedProfile,
            resolvedProfile: null,
            variant: null,
            didFallback: false,
            reason: null,
        }
    }

    const attemptedSet = new Set(attemptedVariantIds)

    for (const fallbackProfile of getPlaybackProfileFallbackChain(requestedProfile)) {
        const matchingVariants = item.variants
            .filter((variant) => !attemptedSet.has(variant.id))
            .filter((variant) => variant.profile === fallbackProfile || variant.supportedProfiles.includes(fallbackProfile))
            .map((variant) => {
                const supportRank = Math.max(
                    getVariantSupportScore(variant, capabilities),
                    ...getCodecProbeStrings(variant).map((probe) => rankProbeResult(probeType(document.createElement('video'), probe))),
                )

                return {
                    variant,
                    supportRank,
                    exactProfileMatch: variant.profile === fallbackProfile ? 1 : 0,
                }
            })
            .sort((left, right) =>
                right.supportRank - left.supportRank ||
                right.exactProfileMatch - left.exactProfileMatch ||
                (right.variant.bitrateKbps ?? 0) - (left.variant.bitrateKbps ?? 0),
            )

        const selectedVariant = matchingVariants.find((entry) => entry.supportRank > 0)?.variant
            ?? matchingVariants[0]?.variant

        if (selectedVariant) {
            return {
                requestedProfile,
                resolvedProfile: fallbackProfile,
                variant: selectedVariant,
                didFallback: fallbackProfile !== requestedProfile,
                reason: fallbackProfile === requestedProfile
                    ? null
                    : buildFallbackReason(requestedProfile, fallbackProfile, selectedVariant),
            }
        }
    }

    return {
        requestedProfile,
        resolvedProfile: null,
        variant: null,
        didFallback: true,
        reason: 'No hay una variante compatible disponible para este dispositivo.',
    }
}