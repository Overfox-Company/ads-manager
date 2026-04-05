import { useEffect, useState } from 'react'
import { fetchPlayerManifest } from '../lib/serverApi'
import type { PlayerManifest } from '../types/network'

const DEFAULT_POLL_INTERVAL_MS = 3000

export function usePlayerManifest(screenId?: string | null, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
    const [manifest, setManifest] = useState<PlayerManifest | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let isDisposed = false

        const loadManifest = async () => {
            try {
                const nextManifest = await fetchPlayerManifest(screenId)

                if (isDisposed) {
                    return
                }

                setManifest(nextManifest)
                setErrorMessage(null)
            } catch (error) {
                if (isDisposed) {
                    return
                }

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'No se pudo sincronizar el estado del player con el backend.',
                )
            } finally {
                if (!isDisposed) {
                    setIsLoading(false)
                }
            }
        }

        void loadManifest()

        const interval = window.setInterval(() => {
            void loadManifest()
        }, pollIntervalMs)

        return () => {
            isDisposed = true
            window.clearInterval(interval)
        }
    }, [pollIntervalMs, screenId])

    return {
        manifest,
        isLoading,
        errorMessage,
        replaceManifest: setManifest,
    }
}