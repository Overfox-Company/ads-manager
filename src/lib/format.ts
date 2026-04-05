import { ORIENTATION_OPTIONS, PLAYBACK_STATUS_LABELS } from './media'
import type { Orientation, PlaybackStatus } from '../types/media'

export function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B'
    }

    const units = ['B', 'KB', 'MB', 'GB']
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / 1024 ** exponent

    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

export function formatDuration(seconds: number | null) {
    if (!seconds || !Number.isFinite(seconds)) {
        return 'Sin dato'
    }

    const totalSeconds = Math.max(1, Math.round(seconds))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const remainingSeconds = totalSeconds % 60

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function formatRelativeDate(timestamp: number) {
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(timestamp)
}

export function formatOrientationLabel(orientation: Orientation) {
    return ORIENTATION_OPTIONS.find((option) => option.value === orientation)?.label ?? orientation
}

export function formatPlaybackStatus(status: PlaybackStatus) {
    return PLAYBACK_STATUS_LABELS[status]
}