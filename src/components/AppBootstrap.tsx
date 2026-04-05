import { useEffect, type PropsWithChildren } from 'react'
import { fetchServerState } from '../lib/serverApi'
import { subscribeToServerState } from '../lib/serverSocket'
import { usePlaylistStore } from '../store/usePlaylistStore'

export function AppBootstrap({ children }: PropsWithChildren) {
    const playlistSignature = usePlaylistStore((state) =>
        state.playlist.map((item) => item.id).join('|'),
    )

    useEffect(() => {
        void usePlaylistStore.getState().ensureMediaUrls()
    }, [playlistSignature])

    useEffect(() => {
        let isMounted = true

        const hydrateState = async () => {
            try {
                const state = await fetchServerState()

                if (!isMounted) {
                    return
                }

                const store = usePlaylistStore.getState()

                store.hydrateRemoteState(state)
                void store.ensureMediaUrls()
            } catch (error) {
                console.error(error)
            }
        }

        void hydrateState()

        const unsubscribe = subscribeToServerState((state) => {
            const store = usePlaylistStore.getState()

            store.hydrateRemoteState(state)
            void store.ensureMediaUrls()
        })

        return () => {
            isMounted = false
            unsubscribe()
        }
    }, [])

    return children
}