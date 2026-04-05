import type { ServerSocketMessage, SharedPlaybackState } from '../types/network'
import { getServerWebSocketUrl } from './serverOrigin'

function getSocketUrl() {
    return getServerWebSocketUrl('/ws')
}

export function subscribeToServerState(onState: (state: SharedPlaybackState) => void) {
    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let isDisposed = false

    const clearReconnectTimer = () => {
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer)
            reconnectTimer = null
        }
    }

    const connect = () => {
        if (isDisposed) {
            return
        }

        socket = new WebSocket(getSocketUrl())

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as ServerSocketMessage

                if (message.type === 'STATE_SYNC') {
                    onState(message.state)
                }
            } catch (error) {
                console.error(error)
            }
        }

        socket.onerror = () => {
            socket?.close()
        }

        socket.onclose = () => {
            socket = null

            if (isDisposed) {
                return
            }

            clearReconnectTimer()
            reconnectTimer = window.setTimeout(connect, 1500)
        }
    }

    connect()

    return () => {
        isDisposed = true
        clearReconnectTimer()
        socket?.close()
    }
}