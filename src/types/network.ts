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