export type MediaType = 'image' | 'video'

export type PlaybackStatus = 'playing' | 'paused' | 'stopped'

export type Orientation =
    | 'horizontal'
    | 'vertical'
    | 'horizontal-inverted'
    | 'vertical-inverted'

export interface MediaItem {
    id: string
    name: string
    type: MediaType
    mimeType: string
    size: number
    createdAt: number
    durationOverrideSeconds: number | null
    naturalDurationSeconds: number | null
}

export interface PlaylistSyncSnapshot {
    playlist: MediaItem[]
    currentIndex: number
    selectedItemId: string | null
    orientation: Orientation
    imageDurationSeconds: number
}