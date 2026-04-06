import { useEffect, useRef, useState } from 'react'
import { MediaDropzone } from '../components/MediaDropzone'
import { InspectorPanel } from '../components/InspectorPanel'
import { PlaybackControls } from '../components/PlaybackControls'
import { PlaylistTable } from '../components/PlaylistTable'
import { PreviewPanel } from '../components/PreviewPanel'
import { formatDuration } from '../lib/format'
import { deleteMediaBlob } from '../lib/indexedDb'
import {
    deleteMediaItem,
    reorderPlaylist,
    selectPlaylistItem,
    sendPlaybackAction,
    setCurrentPlaylistIndex,
    updateImageDuration,
    updateItemDurationOverride,
    updateOrientation,
    updatePlaybackProfile,
    uploadMediaFiles,
} from '../lib/serverApi'
import { getMediaCompatibilityWarnings } from '../lib/mediaPolicy'
import { createUploadMediaDescriptorFromFile, getDisplayDurationSeconds } from '../lib/media'
import { usePlaylistStore } from '../store/usePlaylistStore'
import type { Orientation, PlaybackProfileId, UploadMediaDescriptor } from '../types/media'

function clampValue(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function createUploadId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID()
    }

    const randomBytes = new Uint8Array(16)

    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(randomBytes)
    } else {
        for (let index = 0; index < randomBytes.length; index += 1) {
            randomBytes[index] = Math.floor(Math.random() * 256)
        }
    }

    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80

    const hex = Array.from(randomBytes, (value) => value.toString(16).padStart(2, '0')).join('')

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join('-')
}

export function AdminPage() {
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])
    const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null)
    const [uploadWarningMessages, setUploadWarningMessages] = useState<string[]>([])
    const [libraryFilter, setLibraryFilter] = useState<'all' | 'video' | 'image'>('all')
    const [monitorVolume, setMonitorVolume] = useState(72)
    const [monitorMuted, setMonitorMuted] = useState(false)
    const [monitorCurrentTime, setMonitorCurrentTime] = useState(0)
    const [monitorDuration, setMonitorDuration] = useState(0)
    const [clockNow, setClockNow] = useState(() => Date.now())
    const currentVideoRef = useRef<HTMLVideoElement | null>(null)

    const playlist = usePlaylistStore((state) => state.playlist)
    const mediaUrls = usePlaylistStore((state) => state.mediaUrls)
    const currentIndex = usePlaylistStore((state) => state.currentIndex)
    const selectedItemId = usePlaylistStore((state) => state.selectedItemId)
    const status = usePlaylistStore((state) => state.status)
    const orientation = usePlaylistStore((state) => state.orientation)
    const imageDurationSeconds = usePlaylistStore((state) => state.imageDurationSeconds)
    const playbackProfile = usePlaylistStore((state) => state.playbackProfile)
    const lastPlaybackReport = usePlaylistStore((state) => state.lastPlaybackReport)
    const lastCommandAt = usePlaylistStore((state) => state.lastCommandAt)
    const updatedAt = usePlaylistStore((state) => state.updatedAt)

    const selectedIndex = playlist.findIndex((item) => item.id === selectedItemId)
    const selectedItem = selectedIndex >= 0 ? playlist[selectedIndex] : null
    const currentItem = playlist[currentIndex] ?? null
    const selectedUrl = selectedItem ? mediaUrls[selectedItem.id] ?? null : null
    const currentUrl = currentItem ? mediaUrls[currentItem.id] ?? null : null
    const currentItemDurationSeconds = currentItem
        ? getDisplayDurationSeconds(currentItem, imageDurationSeconds) ?? 0
        : 0
    const mediaCounts = {
        all: playlist.length,
        video: playlist.filter((item) => item.type === 'video').length,
        image: playlist.filter((item) => item.type === 'image').length,
    }
    const visiblePlaylist = playlist
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter((entry) => libraryFilter === 'all' || entry.item.type === libraryFilter)

    const fallbackProgressSeconds = !currentItem
        ? 0
        : status === 'playing'
            ? clampValue((clockNow - updatedAt) / 1000, 0, currentItemDurationSeconds || 0)
            : status === 'paused'
                ? clampValue((lastCommandAt - updatedAt) / 1000, 0, currentItemDurationSeconds || 0)
                : 0

    const effectiveDurationSeconds = currentItem?.type === 'video'
        ? monitorDuration || currentItemDurationSeconds
        : currentItemDurationSeconds

    const effectiveCurrentTimeSeconds = currentItem?.type === 'video'
        ? clampValue(monitorCurrentTime, 0, effectiveDurationSeconds || monitorCurrentTime || 0)
        : fallbackProgressSeconds

    const currentItemDurationLabel = currentItem ? formatDuration(effectiveDurationSeconds) : 'Sin dato'

    useEffect(() => {
        if (status !== 'playing' || !currentItem || currentItem.type === 'video') {
            return undefined
        }

        const intervalId = window.setInterval(() => {
            setClockNow(Date.now())
        }, 250)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [currentItem, status])

    useEffect(() => {
        const video = currentVideoRef.current

        if (!video) {
            return
        }

        video.volume = clampValue(monitorVolume / 100, 0, 1)
        video.muted = monitorMuted
    }, [monitorMuted, monitorVolume])

    useEffect(() => {
        setMonitorCurrentTime(0)
        setMonitorDuration(currentItem?.type === 'video' ? 0 : currentItemDurationSeconds)
    }, [currentItem?.id, currentItem?.type, currentItemDurationSeconds])

    const handleFilesAccepted = async (files: File[]) => {
        setIsUploading(true)
        setSelectedFiles(files.map((file) => file.name))
        setUploadErrorMessage(null)
        setUploadWarningMessages([])

        try {
            const uploads: Array<{ file: File; item: UploadMediaDescriptor }> = []

            for (const file of files) {
                const id = createUploadId()
                const createdAt = Date.now()
                const item = await createUploadMediaDescriptorFromFile(file, id, createdAt)

                if (!item) {
                    continue
                }

                uploads.push({ file, item })
            }

            if (uploads.length === 0) {
                setUploadErrorMessage('No se pudo preparar ningun archivo valido para subir.')
                return
            }

            const clientWarnings = Array.from(new Set(
                uploads
                    .flatMap((entry) => getMediaCompatibilityWarnings(entry.item))
                    .map((warning) => warning.message),
            ))

            const uploadResult = await uploadMediaFiles(
                uploads.map((entry) => entry.file),
                uploads.map((entry) => entry.item),
            )

            setUploadWarningMessages(Array.from(new Set([
                ...clientWarnings,
                ...uploadResult.warnings.map((warning) => warning.message),
            ])))

            const store = usePlaylistStore.getState()

            store.hydrateRemoteState(uploadResult.state)
            void store.ensureMediaUrls()
        } catch (error) {
            console.error(error)
            setUploadErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los archivos seleccionados.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleOrientationChange = async (value: Orientation) => {
        try {
            usePlaylistStore.getState().hydrateRemoteState(await updateOrientation(value))
        } catch (error) {
            console.error(error)
        }
    }

    const playFromIndex = async (index?: number) => {
        const store = usePlaylistStore.getState()

        if (store.playlist.length === 0) {
            return
        }

        const targetIndex = typeof index === 'number'
            ? index
            : selectedIndex >= 0
                ? selectedIndex
                : store.currentIndex

        try {
            store.hydrateRemoteState(await sendPlaybackAction('play', targetIndex))
        } catch (error) {
            console.error(error)
        }
    }

    const handlePlay = () => {
        void playFromIndex()
    }

    const handlePause = () => {
        void sendPlaybackAction('pause')
            .then((state) => {
                usePlaylistStore.getState().hydrateRemoteState(state)
            })
            .catch((error) => {
                console.error(error)
            })
    }

    const handleNext = () => {
        void sendPlaybackAction('next')
            .then((state) => {
                usePlaylistStore.getState().hydrateRemoteState(state)
            })
            .catch((error) => {
                console.error(error)
            })
    }

    const handlePrevious = () => {
        void sendPlaybackAction('previous')
            .then((state) => {
                usePlaylistStore.getState().hydrateRemoteState(state)
            })
            .catch((error) => {
                console.error(error)
            })
    }

    const handleStop = () => {
        void sendPlaybackAction('stop')
            .then((state) => {
                usePlaylistStore.getState().hydrateRemoteState(state)
            })
            .catch((error) => {
                console.error(error)
            })
    }

    const handleSetCurrentIndex = async (index: number) => {
        try {
            usePlaylistStore.getState().hydrateRemoteState(await setCurrentPlaylistIndex(index))
        } catch (error) {
            console.error(error)
        }
    }

    const handleMonitorVolumeChange = (value: number) => {
        const nextVolume = clampValue(Math.round(value), 0, 100)

        setMonitorVolume(nextVolume)

        if (nextVolume > 0) {
            setMonitorMuted(false)
        }
    }

    const handleMonitorMuteToggle = () => {
        setMonitorMuted((current) => !current)
    }

    const handleTimelineSeek = (value: number) => {
        if (currentItem?.type !== 'video') {
            return
        }

        const video = currentVideoRef.current

        if (!video) {
            return
        }

        const nextTime = clampValue(value, 0, Number.isFinite(video.duration) ? video.duration : value)

        video.currentTime = nextTime
        setMonitorCurrentTime(nextTime)
    }

    return (
        <div className="app-shell">
            <main className="admin-layout">
                <MediaDropzone
                    activeFilter={libraryFilter}
                    filterCounts={mediaCounts}
                    isBusy={isUploading}
                    itemCount={playlist.length}
                    onFilesAccepted={handleFilesAccepted}
                    onFilterChange={setLibraryFilter}
                    selectedFiles={selectedFiles}
                    uploadErrorMessage={uploadErrorMessage}
                    uploadWarningMessages={uploadWarningMessages}
                >
                    <PlaylistTable
                        currentIndex={currentIndex}
                        entries={visiblePlaylist}
                        imageDurationSeconds={imageDurationSeconds}
                        mediaUrls={mediaUrls}
                        onMove={(fromIndex, toIndex) => {
                            const orderedIds = [...playlist]

                            const [movedItem] = orderedIds.splice(fromIndex, 1)

                            if (!movedItem) {
                                return
                            }

                            orderedIds.splice(toIndex, 0, movedItem)

                            void reorderPlaylist(orderedIds.map((item) => item.id))
                                .then((state) => {
                                    usePlaylistStore.getState().hydrateRemoteState(state)
                                })
                                .catch((error) => {
                                    console.error(error)
                                })
                        }}
                        onRemove={(id) => {
                            void deleteMediaItem(id)
                                .then(async (state) => {
                                    usePlaylistStore.getState().hydrateRemoteState(state)
                                    await deleteMediaBlob(id).catch(() => undefined)
                                })
                                .catch((error) => {
                                    console.error(error)
                                })
                        }}
                        onPlayIndex={(index) => {
                            void playFromIndex(index)
                        }}
                        onSelect={(id) => {
                            void selectPlaylistItem(id)
                                .then((state) => {
                                    usePlaylistStore.getState().hydrateRemoteState(state)
                                })
                                .catch((error) => {
                                    console.error(error)
                                })
                        }}
                        selectedItemId={selectedItemId}
                        totalCount={playlist.length}
                    />
                </MediaDropzone>

                <PreviewPanel
                    currentIndex={currentIndex}
                    currentItem={currentItem}
                    currentUrl={currentUrl}
                    currentVideoRef={currentVideoRef}
                    imageDurationSeconds={imageDurationSeconds}
                    onVideoDurationChange={(event) => {
                        const nextDuration = Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : 0

                        setMonitorDuration(nextDuration)
                    }}
                    onVideoLoadedMetadata={(event) => {
                        const nextDuration = Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : 0

                        setMonitorDuration(nextDuration)
                    }}
                    onVideoTimeUpdate={(event) => {
                        setMonitorCurrentTime(event.currentTarget.currentTime)
                    }}
                    onVideoVolumeChange={(event) => {
                        setMonitorVolume(Math.round(event.currentTarget.volume * 100))
                        setMonitorMuted(event.currentTarget.muted)
                    }}
                    orientation={orientation}
                    playlistLength={playlist.length}
                    status={status}
                />

                <InspectorPanel
                    currentIndex={currentIndex}
                    currentItem={currentItem}
                    lastPlaybackReport={lastPlaybackReport}
                    imageDurationSeconds={imageDurationSeconds}
                    onChangeDurationOverride={(id, seconds) => {
                        void updateItemDurationOverride(id, seconds)
                            .then((state) => {
                                usePlaylistStore.getState().hydrateRemoteState(state)
                            })
                            .catch((error) => {
                                console.error(error)
                            })
                    }}
                    onChangeImageDuration={(seconds) => {
                        void updateImageDuration(seconds)
                            .then((state) => {
                                usePlaylistStore.getState().hydrateRemoteState(state)
                            })
                            .catch((error) => {
                                console.error(error)
                            })
                    }}
                    onOrientationChange={(value) => {
                        void handleOrientationChange(value)
                    }}
                    onPlaybackProfileChange={(profile: PlaybackProfileId) => {
                        void updatePlaybackProfile(profile)
                            .then((state) => {
                                usePlaylistStore.getState().hydrateRemoteState(state)
                            })
                            .catch((error) => {
                                console.error(error)
                            })
                    }}
                    onSetCurrentItem={(index) => {
                        void handleSetCurrentIndex(index)
                    }}
                    orientation={orientation}
                    playbackProfile={playbackProfile}
                    playlistLength={playlist.length}
                    selectedIndex={selectedIndex}
                    selectedItem={selectedItem}
                    selectedUrl={selectedUrl}
                    status={status}
                />
            </main>

            <PlaybackControls
                currentIndex={currentIndex}
                currentItem={currentItem}
                currentItemDurationLabel={currentItemDurationLabel}
                currentUrl={currentUrl}
                disabled={playlist.length === 0}
                isMonitorMuted={monitorMuted}
                monitorVolume={monitorVolume}
                onNext={handleNext}
                onPause={handlePause}
                onPlay={handlePlay}
                onPrevious={handlePrevious}
                onSeek={handleTimelineSeek}
                onStop={handleStop}
                onToggleMute={handleMonitorMuteToggle}
                onVolumeChange={handleMonitorVolumeChange}
                playbackTimeSeconds={effectiveCurrentTimeSeconds}
                playbackTotalSeconds={effectiveDurationSeconds}
                playlistLength={playlist.length}
                status={status}
            />
        </div>
    )
}