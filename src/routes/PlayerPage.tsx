import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { advancePlayer, reportPlayerIssue } from '../lib/serverApi'
import { IdleState } from '../player/IdleState'
import { MediaRenderer } from '../player/MediaRenderer'
import { PlayerStage } from '../player/PlayerStage'
import { usePlayerManifest } from '../player/usePlayerManifest'
import type { PlayerAdvanceReason, PlayerIssueReason, PlayerManifest } from '../types/network'

const MEDIA_LOAD_TIMEOUT_MS = 15000

function clampIndex(index: number, length: number) {
    if (length === 0) {
        return 0
    }

    return Math.min(Math.max(index, 0), length - 1)
}

function resolveIdleState(manifest: PlayerManifest | null, errorMessage: string | null, isLoading: boolean) {
    if (isLoading && !manifest) {
        return {
            title: 'Conectando con el backend',
            message: 'Recuperando el manifiesto de reproduccion para esta pantalla.',
            detail: null,
            statusLabel: 'Sincronizando',
        }
    }

    if (errorMessage && !manifest) {
        return {
            title: 'Sin conexion con el backend',
            message: 'La pantalla no pudo recuperar el estado actual de reproduccion.',
            detail: errorMessage,
            statusLabel: 'Offline',
        }
    }

    if (!manifest || manifest.items.length === 0) {
        return {
            title: 'Sin contenido activo',
            message: 'El backend no tiene una playlist disponible para reproducir en esta pantalla.',
            detail: null,
            statusLabel: 'Idle',
        }
    }

    if (manifest.isPaused) {
        return {
            title: 'Reproduccion en pausa',
            message: 'La playlist esta pausada desde administracion.',
            detail: null,
            statusLabel: 'Pausado',
        }
    }

    return {
        title: 'Esperando reproduccion',
        message: 'La pantalla quedara lista hasta que el backend marque la playlist como activa.',
        detail: null,
        statusLabel: 'Idle',
    }
}

export function PlayerPage() {
    const { screenId } = useParams<{ screenId?: string }>()
    const { manifest, isLoading, errorMessage, replaceManifest } = usePlayerManifest(screenId)
    const [readyState, setReadyState] = useState<{ key: string; ready: boolean }>({ key: '', ready: false })
    const [runtimeState, setRuntimeState] = useState<{ key: string; detail: string | null }>({
        key: '',
        detail: null,
    })
    const [exhaustedPlaylistId, setExhaustedPlaylistId] = useState<string | null>(null)
    const failureHistoryRef = useRef<{ playlistId: string; itemIds: Set<string> }>({
        playlistId: '',
        itemIds: new Set<string>(),
    })
    const handledEventKeysRef = useRef<Set<string>>(new Set())

    const currentItem = useMemo(() => {
        if (!manifest || manifest.items.length === 0) {
            return null
        }

        return manifest.items[clampIndex(manifest.currentIndex, manifest.items.length)] ?? null
    }, [manifest])

    const currentPlaybackKey = manifest && currentItem
        ? `${manifest.version}:${currentItem.id}`
        : 'idle'
    const isMediaReady = readyState.key === currentPlaybackKey && readyState.ready
    const runtimeDetail = runtimeState.key === currentPlaybackKey ? runtimeState.detail : null

    useEffect(() => {
        if (!manifest) {
            return
        }

        if (failureHistoryRef.current.playlistId !== manifest.playlistId) {
            failureHistoryRef.current = {
                playlistId: manifest.playlistId,
                itemIds: new Set<string>(),
            }
        }
    }, [manifest])

    const markFailedItem = (failedItemId: string, activeManifest: PlayerManifest) => {
        if (failureHistoryRef.current.playlistId !== activeManifest.playlistId) {
            failureHistoryRef.current = {
                playlistId: activeManifest.playlistId,
                itemIds: new Set<string>(),
            }
        }

        failureHistoryRef.current.itemIds.add(failedItemId)

        if (failureHistoryRef.current.itemIds.size >= activeManifest.items.length) {
            setExhaustedPlaylistId(activeManifest.playlistId)
        }
    }

    const withEventGuard = (reason: string) => {
        if (!manifest || !currentItem) {
            return false
        }

        const eventKey = `${manifest.version}:${currentItem.id}:${reason}`

        if (handledEventKeysRef.current.has(eventKey)) {
            return false
        }

        if (handledEventKeysRef.current.size > 128) {
            handledEventKeysRef.current.clear()
        }

        handledEventKeysRef.current.add(eventKey)
        return true
    }

    const handleAdvance = async (reason: PlayerAdvanceReason) => {
        if (!manifest || !currentItem || !withEventGuard(reason)) {
            return
        }

        try {
            replaceManifest(await advancePlayer(currentItem.id, manifest.version, reason, screenId))
        } catch (error) {
            setRuntimeState({
                key: currentPlaybackKey,
                detail:
                    error instanceof Error
                        ? error.message
                        : 'No se pudo informar al backend que el item termino.',
            })
        }
    }

    const handleFailure = async (reason: PlayerIssueReason, detail: string) => {
        if (!manifest || !currentItem || !withEventGuard(reason)) {
            return
        }

        setRuntimeState({ key: currentPlaybackKey, detail })
        markFailedItem(currentItem.id, manifest)

        try {
            replaceManifest(await reportPlayerIssue(currentItem.id, manifest.version, reason, detail, screenId))
        } catch (error) {
            setRuntimeState({
                key: currentPlaybackKey,
                detail:
                    error instanceof Error
                        ? error.message
                        : detail,
            })
        }
    }

    useEffect(() => {
        if (!manifest || !manifest.isPlaying || !currentItem || exhaustedPlaylistId === manifest.playlistId) {
            return
        }

        if (isMediaReady) {
            return
        }

        const timeout = window.setTimeout(() => {
            if (!manifest || !currentItem) {
                return
            }

            const eventKey = `${manifest.version}:${currentItem.id}:load-timeout`

            if (handledEventKeysRef.current.has(eventKey)) {
                return
            }

            if (handledEventKeysRef.current.size > 128) {
                handledEventKeysRef.current.clear()
            }

            handledEventKeysRef.current.add(eventKey)

            setRuntimeState({
                key: currentPlaybackKey,
                detail: 'El medio actual no respondio dentro del tiempo esperado.',
            })
            markFailedItem(currentItem.id, manifest)

            void reportPlayerIssue(
                currentItem.id,
                manifest.version,
                'load-timeout',
                'El medio actual no respondio dentro del tiempo esperado.',
                screenId,
            )
                .then((nextManifest) => {
                    replaceManifest(nextManifest)
                })
                .catch((error) => {
                    setRuntimeState({
                        key: currentPlaybackKey,
                        detail: error instanceof Error ? error.message : 'El medio actual no respondio dentro del tiempo esperado.',
                    })
                })
        }, MEDIA_LOAD_TIMEOUT_MS)

        return () => {
            window.clearTimeout(timeout)
        }
    }, [currentItem, currentPlaybackKey, exhaustedPlaylistId, isMediaReady, manifest, replaceManifest, screenId])

    useEffect(() => {
        if (
            !manifest ||
            !manifest.isPlaying ||
            !currentItem ||
            currentItem.type !== 'image' ||
            !isMediaReady ||
            exhaustedPlaylistId === manifest.playlistId
        ) {
            return
        }

        const durationMs = Math.max(1, currentItem.duration ?? manifest.imageDurationSeconds) * 1000
        const timeout = window.setTimeout(() => {
            if (!manifest || !currentItem) {
                return
            }

            const eventKey = `${manifest.version}:${currentItem.id}:image-timeout`

            if (handledEventKeysRef.current.has(eventKey)) {
                return
            }

            if (handledEventKeysRef.current.size > 128) {
                handledEventKeysRef.current.clear()
            }

            handledEventKeysRef.current.add(eventKey)

            void advancePlayer(currentItem.id, manifest.version, 'image-timeout', screenId)
                .then((nextManifest) => {
                    replaceManifest(nextManifest)
                })
                .catch((error) => {
                    setRuntimeState({
                        key: currentPlaybackKey,
                        detail: error instanceof Error ? error.message : 'No se pudo informar al backend que la imagen termino.',
                    })
                })
        }, durationMs)

        return () => {
            window.clearTimeout(timeout)
        }
    }, [currentItem, currentPlaybackKey, exhaustedPlaylistId, isMediaReady, manifest, replaceManifest, screenId])

    const shouldRenderMedia = Boolean(
        manifest &&
        manifest.isPlaying &&
        currentItem &&
        exhaustedPlaylistId !== manifest.playlistId,
    )

    const idleState = exhaustedPlaylistId === manifest?.playlistId
        ? {
            title: 'Sin medios reproducibles',
            message: 'Todos los items de la playlist actual fallaron o no parecen compatibles con este navegador.',
            detail: runtimeDetail,
            statusLabel: 'Fallback',
        }
        : resolveIdleState(manifest, errorMessage, isLoading)

    return (
        <PlayerStage orientation={manifest?.orientation ?? 'horizontal'}>
            {shouldRenderMedia && currentItem ? (
                <MediaRenderer
                    item={currentItem}
                    key={currentPlaybackKey}
                    onCompleted={() => {
                        void handleAdvance('completed')
                    }}
                    onFailure={(reason, detail) => {
                        void handleFailure(reason, detail)
                    }}
                    onReady={() => {
                        setReadyState({ key: currentPlaybackKey, ready: true })
                        setRuntimeState({ key: currentPlaybackKey, detail: null })
                    }}
                />
            ) : (
                <IdleState
                    detail={idleState.detail}
                    message={idleState.message}
                    statusLabel={idleState.statusLabel}
                    title={idleState.title}
                />
            )}
        </PlayerStage>
    )
}