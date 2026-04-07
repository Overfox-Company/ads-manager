export type MediaType = 'image' | 'video'

export type PlaybackStatus = 'playing' | 'paused' | 'stopped'

export type PlaybackProfileId =
    | 'compatibility'
    | 'balanced'
    | 'native'
    | 'modern-efficiency'
    | 'modern-quality'
    | 'av1-experimental'

export type VideoContainer = 'mp4' | 'webm' | 'unknown'

export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'unknown'

export type AudioCodec = 'aac' | 'opus' | 'unknown'

export type Orientation =
    | 'horizontal'
    | 'vertical'
    | 'horizontal-inverted'
    | 'vertical-inverted'

export interface MediaVariant {
    id: string
    storageId: string
    label: string
    profile: PlaybackProfileId
    supportedProfiles: PlaybackProfileId[]
    container: VideoContainer
    videoCodec: VideoCodec
    audioCodec: AudioCodec
    width: number | null
    height: number | null
    fps: number | null
    bitrateKbps: number | null
    mimeType: string
    isMaster: boolean
}

export interface MediaItem {
    id: string
    storageId: string
    name: string
    type: MediaType
    mimeType: string
    size: number
    createdAt: number
    durationOverrideSeconds: number | null
    naturalDurationSeconds: number | null
    variants: MediaVariant[]
}

export interface UploadMediaDescriptor {
    id: string
    name: string
    type: MediaType
    mimeType: string
    size: number
    createdAt: number
    naturalDurationSeconds: number | null
    width: number | null
    height: number | null
    fps: number | null
    bitrateKbps: number | null
    variantGroupKey: string | null
    variantProfileHint: PlaybackProfileId | null
    videoCodecHint: VideoCodec
    audioCodecHint: AudioCodec
    containerHint: VideoContainer
}

export interface PlaylistSyncSnapshot {
    playlist: MediaItem[]
    currentIndex: number
    selectedItemId: string | null
    orientation: Orientation
    imageDurationSeconds: number
    playbackProfile: PlaybackProfileId
}