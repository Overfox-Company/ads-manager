import type { Orientation, PlaybackProfileId, UploadMediaDescriptor } from '../types/media'
import { getServerHttpUrl } from './serverOrigin'
import type {
    ApiWarning,
    DurationOverrideRequest,
    ImageDurationRequest,
    OrientationRequest,
    PlaybackProfileRequest,
    PlaybackAction,
    PlaybackActionRequest,
    PlayerAdvanceReason,
    PlayerAdvanceRequest,
    PlayerPlaybackReportRequest,
    PlayerIssueReason,
    PlayerIssueRequest,
    PlayerManifestResponse,
    PlaylistCurrentIndexRequest,
    PlaylistReorderRequest,
    PlaylistSelectionRequest,
    SharedPlaybackState,
    StateResponse,
    UploadMediaResponse,
} from '../types/network'

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch(input, {
        ...init,
        headers: {
            ...(init?.headers ?? {}),
        },
    })

    if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message =
            payload && typeof payload === 'object' && 'error' in payload
                ? String(payload.error)
                : 'No se pudo completar la solicitud al servidor'

        throw new Error(message)
    }

    return response.json() as Promise<T>
}

function jsonRequest<TBody>(body: TBody): RequestInit {
    return {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    }
}

function buildPlayerManifestUrl(screenId?: string | null) {
    const url = new URL(getServerHttpUrl('/api/player/manifest'))

    if (screenId) {
        url.searchParams.set('screenId', screenId)
    }

    return url.toString()
}

export function getMediaContentUrl(id: string) {
    return getServerHttpUrl(`/api/media/${id}/content`)
}

export async function fetchServerState() {
    const payload = await requestJson<StateResponse>(getServerHttpUrl('/api/state'))

    return payload.state
}

export async function fetchPlayerManifest(screenId?: string | null) {
    const payload = await requestJson<PlayerManifestResponse>(buildPlayerManifestUrl(screenId))

    return payload.manifest
}

export async function uploadMediaFiles(files: File[], items: UploadMediaDescriptor[]) {
    const formData = new FormData()

    for (const file of files) {
        formData.append('files', file)
    }

    formData.append('metadata', JSON.stringify(items))

    const payload = await requestJson<UploadMediaResponse>(getServerHttpUrl('/api/media/upload'), {
        method: 'POST',
        body: formData,
    })

    return {
        state: payload.state,
        warnings: payload.warnings ?? [],
    } satisfies {
        state: SharedPlaybackState
        warnings: ApiWarning[]
    }
}

export async function deleteMediaItem(id: string) {
    const payload = await requestJson<StateResponse>(getServerHttpUrl(`/api/media/${id}`), {
        method: 'DELETE',
    })

    return payload.state
}

export async function reorderPlaylist(orderedIds: string[]) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/playlist/reorder'),
        jsonRequest<PlaylistReorderRequest>({ orderedIds }),
    )

    return payload.state
}

export async function selectPlaylistItem(selectedItemId: string | null) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/playlist/select'),
        jsonRequest<PlaylistSelectionRequest>({ selectedItemId }),
    )

    return payload.state
}

export async function setCurrentPlaylistIndex(index: number) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/playlist/current'),
        jsonRequest<PlaylistCurrentIndexRequest>({ index }),
    )

    return payload.state
}

export async function updateOrientation(orientation: Orientation) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/settings/orientation'),
        jsonRequest<OrientationRequest>({ orientation }),
    )

    return payload.state
}

export async function updateImageDuration(seconds: number) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/settings/image-duration'),
        jsonRequest<ImageDurationRequest>({ seconds }),
    )

    return payload.state
}

export async function updatePlaybackProfile(profile: PlaybackProfileId) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/settings/playback-profile'),
        jsonRequest<PlaybackProfileRequest>({ profile }),
    )

    return payload.state
}

export async function updateItemDurationOverride(id: string, seconds: number | null) {
    const payload = await requestJson<StateResponse>(
        getServerHttpUrl('/api/playlist/duration-override'),
        jsonRequest<DurationOverrideRequest>({ id, seconds }),
    )

    return payload.state
}

export async function sendPlaybackAction(action: PlaybackAction, index?: number): Promise<SharedPlaybackState> {
    const body: PlaybackActionRequest = index === undefined ? { action } : { action, index }
    const payload = await requestJson<StateResponse>(getServerHttpUrl('/api/playback'), jsonRequest(body))

    return payload.state
}

export async function advancePlayer(
    expectedItemId: string | null,
    expectedVersion: number,
    reason: PlayerAdvanceReason,
    screenId?: string | null,
) {
    const payload = await requestJson<PlayerManifestResponse>(
        getServerHttpUrl('/api/player/advance'),
        jsonRequest<PlayerAdvanceRequest>({ expectedItemId, expectedVersion, reason, screenId }),
    )

    return payload.manifest
}

export async function reportPlayerIssue(
    itemId: string | null,
    expectedVersion: number,
    reason: PlayerIssueReason,
    detail?: string | null,
    screenId?: string | null,
) {
    const payload = await requestJson<PlayerManifestResponse>(
        getServerHttpUrl('/api/player/issues'),
        jsonRequest<PlayerIssueRequest>({ itemId, expectedVersion, reason, detail, screenId }),
    )

    return payload.manifest
}

export async function reportPlayerPlayback(payload: PlayerPlaybackReportRequest) {
    const response = await requestJson<StateResponse>(
        getServerHttpUrl('/api/player/playback-report'),
        jsonRequest<PlayerPlaybackReportRequest>(payload),
    )

    return response.state
}