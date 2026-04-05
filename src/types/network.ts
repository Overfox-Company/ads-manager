import type { MediaItem, Orientation, PlaybackStatus } from './media'

export interface SharedPlaybackState {
    playlist: MediaItem[]
    currentIndex: number
    selectedItemId: string | null
    status: PlaybackStatus
    orientation: Orientation
    imageDurationSeconds: number
    lastCommandAt: number
    updatedAt: number
}

export interface StateResponse {
    state: SharedPlaybackState
    warnings?: ApiWarning[]
}

export interface ApiWarning {
    code: 'RECOMMENDED_VIDEO_FORMAT'
    message: string
    itemId: string | null
}

export interface PlayerManifestItem {
    id: string
    name: string
    type: 'image' | 'video'
    src: string
    mime: string
    duration: number | null
}

export interface PlayerManifest {
    playlistId: string
    version: number
    status: PlaybackStatus
    isPlaying: boolean
    isPaused: boolean
    currentIndex: number
    currentItemId: string | null
    orientation: Orientation
    imageDurationSeconds: number
    updatedAt: number
    items: PlayerManifestItem[]
}

export interface PlayerManifestResponse {
    manifest: PlayerManifest
}

export type PlayerAdvanceReason = 'completed' | 'image-timeout'

export type PlayerIssueReason = 'load-timeout' | 'media-error' | 'unsupported'

export interface PlayerAdvanceRequest {
    expectedItemId: string | null
    expectedVersion: number
    reason: PlayerAdvanceReason
    screenId?: string | null
}

export interface PlayerIssueRequest {
    itemId: string | null
    expectedVersion: number
    reason: PlayerIssueReason
    detail?: string | null
    screenId?: string | null
}

export type PlaybackAction = 'play' | 'pause' | 'stop' | 'next' | 'previous'

export interface PlaybackActionRequest {
    action: PlaybackAction
    index?: number
}

export interface PlaylistReorderRequest {
    orderedIds: string[]
}

export interface PlaylistSelectionRequest {
    selectedItemId: string | null
}

export interface PlaylistCurrentIndexRequest {
    index: number
}

export interface OrientationRequest {
    orientation: Orientation
}

export interface ImageDurationRequest {
    seconds: number
}

export interface DurationOverrideRequest {
    id: string
    seconds: number | null
}

export type ServerSocketMessage = {
    type: 'STATE_SYNC'
    state: SharedPlaybackState
}