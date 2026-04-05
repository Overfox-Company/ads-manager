import { MonitorStopIcon } from '@hugeicons-pro/core-solid-standard'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { formatOrientationLabel, formatPlaybackStatus } from '../lib/format'
import { getDisplayDurationSeconds } from '../lib/media'
import { sendPlaybackAction } from '../lib/serverApi'
import { usePlaylistStore } from '../store/usePlaylistStore'
import type { MediaItem } from '../types/media'

const PRELOAD_THRESHOLD_SECONDS = 2.5

type SlotName = 'primary' | 'secondary'

type PlayerSlot = {
    item: MediaItem | null
    url: string | null
    ready: boolean
}

const EMPTY_SLOT: PlayerSlot = {
    item: null,
    url: null,
    ready: false,
}

function getNextItem(items: MediaItem[], currentIndex: number) {
    if (items.length < 2) {
        return null
    }

    return items[(currentIndex + 1) % items.length] ?? null
}

export function PlayerPage() {
    const playlist = usePlaylistStore((state) => state.playlist)
    const mediaUrls = usePlaylistStore((state) => state.mediaUrls)
    const currentIndex = usePlaylistStore((state) => state.currentIndex)
    const status = usePlaylistStore((state) => state.status)
    const orientation = usePlaylistStore((state) => state.orientation)
    const imageDurationSeconds = usePlaylistStore((state) => state.imageDurationSeconds)

    const currentItem = playlist[currentIndex] ?? null
    const currentUrl = currentItem ? mediaUrls[currentItem.id] ?? null : null
    const nextItem = getNextItem(playlist, currentIndex)
    const nextUrl = nextItem ? mediaUrls[nextItem.id] ?? null : null

    const [activeSlot, setActiveSlot] = useState<SlotName>('primary')
    const [primarySlot, setPrimarySlot] = useState<PlayerSlot>(EMPTY_SLOT)
    const [secondarySlot, setSecondarySlot] = useState<PlayerSlot>(EMPTY_SLOT)
    const [preloadTargetId, setPreloadTargetId] = useState<string | null>(null)

    const primaryVideoRef = useRef<HTMLVideoElement | null>(null)
    const secondaryVideoRef = useRef<HTMLVideoElement | null>(null)
    const previousCurrentItemIdRef = useRef<string | null>(null)

    const activeMedia = activeSlot === 'primary' ? primarySlot : secondarySlot
    const standbySlotName: SlotName = activeSlot === 'primary' ? 'secondary' : 'primary'
    const standbyMedia = standbySlotName === 'primary' ? primarySlot : secondarySlot
    const displayedItem = activeMedia.item ?? currentItem
    const displayedIndex = displayedItem
        ? playlist.findIndex((item) => item.id === displayedItem.id)
        : currentIndex

    const setSlot = (slotName: SlotName, nextValue: PlayerSlot) => {
        if (slotName === 'primary') {
            setPrimarySlot(nextValue)
            return
        }

        setSecondarySlot(nextValue)
    }

    const updateSlotReady = (slotName: SlotName, itemId: string) => {
        if (slotName === 'primary') {
            setPrimarySlot((current) =>
                current.item?.id === itemId
                    ? { ...current, ready: true }
                    : current,
            )
            return
        }

        setSecondarySlot((current) =>
            current.item?.id === itemId
                ? { ...current, ready: true }
                : current,
        )
    }

    const resetPreloadTarget = useEffectEvent(() => {
        setPreloadTargetId(null)
    })

    const syncCurrentSlot = useEffectEvent((nextItem: MediaItem | null, nextUrlValue: string | null) => {
        if (!nextItem || !nextUrlValue || status === 'stopped') {
            return
        }

        if (activeMedia.item?.id === nextItem.id && activeMedia.url === nextUrlValue) {
            return
        }

        if (
            standbyMedia.item?.id === nextItem.id &&
            standbyMedia.url === nextUrlValue &&
            standbyMedia.ready
        ) {
            setActiveSlot(standbySlotName)
            return
        }

        if (!activeMedia.item || !activeMedia.url) {
            setSlot(activeSlot, {
                item: nextItem,
                url: nextUrlValue,
                ready: nextItem.type === 'image',
            })
            return
        }

        setSlot(standbySlotName, {
            item: nextItem,
            url: nextUrlValue,
            ready: false,
        })
    })

    const syncStandbySlot = useEffectEvent((nextTargetId: string | null) => {
        if (!nextTargetId) {
            return
        }

        const preloadItem = playlist.find((item) => item.id === nextTargetId) ?? null
        const preloadUrl = preloadItem ? mediaUrls[preloadItem.id] ?? null : null

        if (!preloadItem || !preloadUrl) {
            return
        }

        if (standbyMedia.item?.id === preloadItem.id && standbyMedia.url === preloadUrl) {
            return
        }

        setSlot(standbySlotName, {
            item: preloadItem,
            url: preloadUrl,
            ready: false,
        })
    })

    useEffect(() => {
        if (previousCurrentItemIdRef.current !== (currentItem?.id ?? null)) {
            previousCurrentItemIdRef.current = currentItem?.id ?? null
            resetPreloadTarget()
        }

        syncCurrentSlot(currentItem, currentUrl)
    }, [
        activeMedia.item?.id,
        activeMedia.url,
        activeSlot,
        currentItem,
        currentUrl,
        standbyMedia.item?.id,
        standbyMedia.ready,
        standbyMedia.url,
        standbySlotName,
        status,
    ])

    useEffect(() => {
        if (!currentItem || currentItem.type !== 'image' || !currentUrl || status !== 'playing') {
            return
        }

        const durationSeconds = getDisplayDurationSeconds(currentItem, imageDurationSeconds)

        if (!durationSeconds) {
            return
        }

        const timeout = window.setTimeout(() => {
            const store = usePlaylistStore.getState()

            if (store.playlist.length === 0 || store.status !== 'playing') {
                return
            }

            void sendPlaybackAction('next').catch((error) => {
                console.error(error)
            })
        }, durationSeconds * 1000)

        return () => {
            window.clearTimeout(timeout)
        }
    }, [currentItem, currentUrl, imageDurationSeconds, status])

    useEffect(() => {
        const video = activeSlot === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current

        if (!video || activeMedia.item?.type !== 'video' || !activeMedia.url) {
            return
        }

        if (status === 'playing') {
            void video.play().catch(() => undefined)
            return
        }

        video.pause()
    }, [activeMedia.item?.id, activeMedia.item?.type, activeMedia.url, activeSlot, status])

    useEffect(() => {
        if (!currentItem || !nextItem || !nextUrl || status !== 'playing') {
            return
        }

        if (currentItem.type === 'image') {
            const durationSeconds = getDisplayDurationSeconds(currentItem, imageDurationSeconds)

            if (!durationSeconds) {
                return
            }

            const preloadDelayMs = Math.max(durationSeconds - PRELOAD_THRESHOLD_SECONDS, 0) * 1000
            const timeout = window.setTimeout(() => {
                setPreloadTargetId((current) => current ?? nextItem.id)
            }, preloadDelayMs)

            return () => {
                window.clearTimeout(timeout)
            }
        }

        const video = activeSlot === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current

        if (!video) {
            return
        }

        const handleTimeUpdate = () => {
            if (!Number.isFinite(video.duration)) {
                return
            }

            if (video.duration - video.currentTime <= PRELOAD_THRESHOLD_SECONDS) {
                setPreloadTargetId((current) => current ?? nextItem.id)
            }
        }

        video.addEventListener('timeupdate', handleTimeUpdate)
        handleTimeUpdate()

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate)
        }
    }, [activeSlot, currentItem, imageDurationSeconds, nextItem, nextUrl, status])

    useEffect(() => {
        syncStandbySlot(preloadTargetId)
    }, [preloadTargetId])

    const stageClassName = `player-stage player-stage--${orientation}`

    const renderSlot = (slotName: SlotName, slot: PlayerSlot, isActive: boolean) => {
        if (!slot.item || !slot.url) {
            return null
        }

        const className = `player-media-layer${isActive ? ' player-media-layer--active' : ' player-media-layer--standby'}`

        if (slot.item.type === 'image') {
            return (
                <div className={className} key={`${slotName}-${slot.item.id}`}>
                    <img
                        alt={slot.item.name}
                        className="player-media"
                        loading="eager"
                        onLoad={() => updateSlotReady(slotName, slot.item!.id)}
                        src={slot.url}
                    />
                </div>
            )
        }

        return (
            <div className={className} key={`${slotName}-${slot.item.id}`}>
                <video
                    className="player-media"
                    muted
                    onCanPlay={() => updateSlotReady(slotName, slot.item!.id)}
                    onEnded={() => {
                        if (!isActive) {
                            return
                        }

                        const store = usePlaylistStore.getState()

                        if (store.playlist.length === 0 || store.status !== 'playing') {
                            return
                        }

                        void sendPlaybackAction('next').catch((error) => {
                            console.error(error)
                        })
                    }}
                    onLoadedData={() => updateSlotReady(slotName, slot.item!.id)}
                    playsInline
                    preload="auto"
                    ref={slotName === 'primary' ? primaryVideoRef : secondaryVideoRef}
                    src={slot.url}
                />
            </div>
        )
    }

    return (
        <div className="player-shell">
            <div className={stageClassName}>
                <div className="player-stage__viewport">
                    <div className="player-stage__content">
                        {status === 'stopped' || !currentItem ? (
                            <div className="player-idle">
                                <Icon icon={MonitorStopIcon} size={32} />
                                <h1>{playlist.length === 0 ? 'Sin contenido cargado' : 'Esperando reproduccion'}</h1>
                                <p>
                                    {playlist.length === 0
                                        ? 'Carga medios desde la vista de administracion para habilitar esta pantalla.'
                                        : 'La reproduccion comenzara cuando se pulse Play desde la administracion.'}
                                </p>
                                <div className="player-idle__meta">
                                    <span>Playlist: {playlist.length} items</span>
                                    <span>Orientacion: {formatOrientationLabel(orientation)}</span>
                                    <span>Estado: {formatPlaybackStatus(status)}</span>
                                </div>
                            </div>
                        ) : activeMedia.item && activeMedia.url ? (
                            <>
                                {renderSlot('primary', primarySlot, activeSlot === 'primary')}
                                {renderSlot('secondary', secondarySlot, activeSlot === 'secondary')}

                                <div className="player-overlay">
                                    <span className={`player-pill player-pill--${status}`}>{formatPlaybackStatus(status)}</span>
                                    <span className="player-caption">
                                        {(displayedIndex >= 0 ? displayedIndex : currentIndex) + 1} / {playlist.length} · {(displayedItem ?? currentItem).name}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="player-loading">
                                <Icon icon={MonitorStopIcon} size={32} />
                                <h1>Preparando contenido</h1>
                                <p>Recuperando el medio desde el servidor o la cache local de este navegador.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}