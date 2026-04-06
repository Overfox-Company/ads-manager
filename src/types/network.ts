import type {
    AudioCodec,
    MediaItem,
    MediaVariant,
    Orientation,
    PlaybackProfileId,
    PlaybackStatus,
    UploadMediaDescriptor,
    VideoCodec,
    VideoContainer,
} from './media'

export interface PlaybackTelemetryReport {
    screenId: string | null
    itemId: string | null
    requestedProfile: PlaybackProfileId
    resolvedProfile: PlaybackProfileId | null
    variantId: string | null
    variantLabel: string | null
    videoCodec: VideoCodec | null
    audioCodec: AudioCodec | null
    container: VideoContainer | null
    width: number | null
    height: number | null
    fps: number | null
    bitrateKbps: number | null
    didFallback: boolean
    reason: string | null
    updatedAt: number
}

export interface SharedPlaybackState {
    playlist: MediaItem[]
    currentIndex: number
    selectedItemId: string | null
    status: PlaybackStatus
    orientation: Orientation
    imageDurationSeconds: number
    playbackProfile: PlaybackProfileId
    lastPlaybackReport: PlaybackTelemetryReport | null
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
    storageId: string
    name: string
    type: 'image' | 'video'
    src: string | null
    mime: string | null
    duration: number | null
    variants: PlayerManifestVariant[]
}

export interface PlayerManifestVariant extends MediaVariant {
    src: string
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
    playbackProfile: PlaybackProfileId
    lastPlaybackReport: PlaybackTelemetryReport | null
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

export interface PlaybackProfileRequest {
    profile: PlaybackProfileId
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

export interface PlayerPlaybackReportRequest {
    expectedVersion: number
    itemId: string | null
    screenId?: string | null
    requestedProfile: PlaybackProfileId
    resolvedProfile: PlaybackProfileId | null
    variantId: string | null
    variantLabel: string | null
    videoCodec: VideoCodec | null
    audioCodec: AudioCodec | null
    container: VideoContainer | null
    width: number | null
    height: number | null
    fps: number | null
    bitrateKbps: number | null
    didFallback: boolean
    reason?: string | null
}

export interface UploadMediaResponse extends StateResponse {
    state: SharedPlaybackState
    uploadedMediaIds?: string[]
}

export type UploadMediaMetadata = UploadMediaDescriptor[]

export type ServerSocketMessage = {
    type: 'STATE_SYNC'
    state: SharedPlaybackState
}