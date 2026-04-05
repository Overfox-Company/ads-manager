import type { Orientation, PlaylistSyncSnapshot } from '../types/media'

const CHANNEL_NAME = 'ads-manager-playback'
const senderId = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`

let channel: BroadcastChannel | null = null

export type SyncCommandPayload =
    | { type: 'PLAY' }
    | { type: 'PAUSE' }
    | { type: 'NEXT' }
    | { type: 'PREV' }
    | { type: 'STOP' }
    | { type: 'SET_INDEX'; index: number }
    | { type: 'SET_ORIENTATION'; orientation: Orientation }
    | { type: 'PLAYLIST_UPDATED'; snapshot: PlaylistSyncSnapshot }

export type SyncCommand = SyncCommandPayload & { senderId: string }

function getChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
        return null
    }

    if (!channel) {
        channel = new BroadcastChannel(CHANNEL_NAME)
    }

    return channel
}

export function postSyncMessage(message: SyncCommandPayload) {
    getChannel()?.postMessage({ ...message, senderId })
}

export function subscribeSyncMessages(listener: (message: SyncCommand) => void) {
    const activeChannel = getChannel()

    if (!activeChannel) {
        return () => undefined
    }

    const handleMessage = (event: MessageEvent<SyncCommand>) => {
        if (!event.data || event.data.senderId === senderId) {
            return
        }

        listener(event.data)
    }

    activeChannel.addEventListener('message', handleMessage)

    return () => {
        activeChannel.removeEventListener('message', handleMessage)
    }
}