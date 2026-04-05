import type { MediaItem, Orientation } from '../types/media'
import { getServerHttpUrl } from './serverOrigin'
import type {
    DurationOverrideRequest,
    ImageDurationRequest,
    OrientationRequest,
    PlaybackAction,
    PlaybackActionRequest,
    PlaylistCurrentIndexRequest,
    PlaylistReorderRequest,
    PlaylistSelectionRequest,
    SharedPlaybackState,
    StateResponse,
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

export function getMediaContentUrl(id: string) {
    return getServerHttpUrl(`/api/media/${id}/content`)
}

export async function fetchServerState() {
    const payload = await requestJson<StateResponse>(getServerHttpUrl('/api/state'))

    return payload.state
}

export async function uploadMediaFiles(files: File[], items: MediaItem[]) {
    const formData = new FormData()

    for (const file of files) {
        formData.append('files', file)
    }

    formData.append('metadata', JSON.stringify(items))

    const payload = await requestJson<StateResponse>(getServerHttpUrl('/api/media/upload'), {
        method: 'POST',
        body: formData,
    })

    return payload.state
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