import path from 'node:path'
import type { PlaybackProfileId } from '../src/types/media'

const STORAGE_SEPARATOR = '__ofx__'

const PROFILE_DIRECTORY_NAMES: Record<PlaybackProfileId, string> = {
    compatibility: 'compatibilidad-maxima',
    balanced: 'balanceado',
    native: 'nativa',
    'modern-efficiency': 'eficiencia-moderna',
    'modern-quality': 'calidad-maxima',
    'av1-experimental': 'av1-experimental',
}

function sanitizeSegment(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
}

function normalizeExtension(extension: string | null | undefined) {
    if (!extension) {
        return '.bin'
    }

    return extension.startsWith('.') ? extension : `.${extension}`
}

export function createNativeStorageId(assetId: string, extension: string | null | undefined) {
    return [
        sanitizeSegment(assetId),
        'nativa',
        `original${normalizeExtension(extension)}`,
    ].join(STORAGE_SEPARATOR)
}

export function createVariantStorageId(assetId: string, profile: PlaybackProfileId, extension = '.mp4') {
    return [
        sanitizeSegment(assetId),
        PROFILE_DIRECTORY_NAMES[profile],
        `video${normalizeExtension(extension)}`,
    ].join(STORAGE_SEPARATOR)
}

export function resolveStorageRelativePath(storageId: string) {
    const parts = storageId.split(STORAGE_SEPARATOR)

    if (parts.length !== 3) {
        return storageId
    }

    const [assetId, folderName, fileName] = parts

    return path.join(assetId, folderName, fileName)
}