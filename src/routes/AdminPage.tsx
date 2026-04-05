import { ComputerVideoIcon } from '@hugeicons-pro/core-solid-standard'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { MediaDropzone } from '../components/MediaDropzone'
import { PlaybackControls } from '../components/PlaybackControls'
import { PlaylistTable } from '../components/PlaylistTable'
import { PreviewPanel } from '../components/PreviewPanel'
import { deleteMediaBlob, saveMediaBlob } from '../lib/indexedDb'
import {
    deleteMediaItem,
    reorderPlaylist,
    selectPlaylistItem,
    sendPlaybackAction,
    setCurrentPlaylistIndex,
    updateImageDuration,
    updateItemDurationOverride,
    updateOrientation,
    uploadMediaFiles,
} from '../lib/serverApi'
import { getMediaCompatibilityWarnings } from '../lib/mediaPolicy'
import { ORIENTATION_OPTIONS, createMediaItemFromFile } from '../lib/media'
import { usePlaylistStore } from '../store/usePlaylistStore'
import type { MediaItem, Orientation } from '../types/media'

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

    const playlist = usePlaylistStore((state) => state.playlist)
    const mediaUrls = usePlaylistStore((state) => state.mediaUrls)
    const currentIndex = usePlaylistStore((state) => state.currentIndex)
    const selectedItemId = usePlaylistStore((state) => state.selectedItemId)
    const status = usePlaylistStore((state) => state.status)
    const orientation = usePlaylistStore((state) => state.orientation)
    const imageDurationSeconds = usePlaylistStore((state) => state.imageDurationSeconds)

    const selectedIndex = playlist.findIndex((item) => item.id === selectedItemId)
    const selectedItem = selectedIndex >= 0 ? playlist[selectedIndex] : null
    const currentItem = playlist[currentIndex] ?? null
    const selectedUrl = selectedItem ? mediaUrls[selectedItem.id] ?? null : null

    const handleFilesAccepted = async (files: File[]) => {
        setIsUploading(true)
        setSelectedFiles(files.map((file) => file.name))
        setUploadErrorMessage(null)
        setUploadWarningMessages([])

        try {
            const uploads: Array<{ file: File; item: MediaItem }> = []

            for (const file of files) {
                const id = createUploadId()
                const createdAt = Date.now()
                const item = await createMediaItemFromFile(file, id, createdAt)

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

            for (const entry of uploads) {
                await saveMediaBlob({
                    id: entry.item.id,
                    name: entry.item.name,
                    mimeType: entry.item.mimeType,
                    size: entry.item.size,
                    createdAt: entry.item.createdAt,
                    blob: entry.file,
                })
            }

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

    return (
        <div className="app-shell">
            <header className="admin-header">
                <div className="admin-header__title">
                    <span className="admin-header__eyebrow">Digital Signage LAN</span>
                    <h1>Carteleria Remota</h1>
                    <p>
                        Gestiona la playlist y la reproduccion desde este equipo.
                        El servidor local persiste medios en disco y sincroniza a los players de la red por WebSocket.
                    </p>
                </div>

                <div className="admin-header__actions">
                    <div className="field-stack">
                        <label className="field-stack__label" htmlFor="orientation-select">
                            Orientacion global
                        </label>
                        <select
                            className="select-input"
                            id="orientation-select"
                            onChange={(event) => handleOrientationChange(event.target.value as Orientation)}
                            value={orientation}
                        >
                            {ORIENTATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <PlaybackControls
                        currentIndex={currentIndex}
                        currentItemName={currentItem?.name ?? null}
                        disabled={playlist.length === 0}
                        onNext={handleNext}
                        onPause={handlePause}
                        onPlay={handlePlay}
                        onPrevious={handlePrevious}
                        onStop={handleStop}
                        playlistLength={playlist.length}
                        status={status}
                    />

                    <Link className="app-link" target="_blank" to="/player">
                        <Icon icon={ComputerVideoIcon} />
                        <span className="button-label">Abrir player</span>
                    </Link>
                </div>
            </header>

            <main className="admin-main">
                <section className="pane pane--list">
                    <div className="section-card">
                        <div className="section-card__header">
                            <div className="section-card__title">
                                <h2>Ingesta de medios</h2>
                                <p>Arrastra multiples archivos y quedan disponibles para cualquier player conectado a la red local.</p>
                            </div>
                            <span className="metric-inline">{playlist.length} items</span>
                        </div>

                        <MediaDropzone
                            isBusy={isUploading}
                            itemCount={playlist.length}
                            selectedFiles={selectedFiles}
                            uploadErrorMessage={uploadErrorMessage}
                            uploadWarningMessages={uploadWarningMessages}
                            onFilesAccepted={handleFilesAccepted}
                        />
                    </div>

                    <div className="section-card">
                        <div className="section-card__header">
                            <div className="section-card__title">
                                <h2>Playlist</h2>
                                <p>Lista densa, reordenable y pensada para operacion de oficina.</p>
                            </div>
                            <span className={`status-pill status-pill--${status}`}>{status}</span>
                        </div>

                        <PlaylistTable
                            currentIndex={currentIndex}
                            imageDurationSeconds={imageDurationSeconds}
                            items={playlist}
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
                        />
                    </div>
                </section>

                <aside className="pane pane--detail">
                    <PreviewPanel
                        currentIndex={currentIndex}
                        currentItem={currentItem}
                        currentUrl={currentItem ? mediaUrls[currentItem.id] ?? null : null}
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
                        onSetCurrentItem={(index) => {
                            void handleSetCurrentIndex(index)
                        }}
                        orientation={orientation}
                        playlistLength={playlist.length}
                        selectedIndex={selectedIndex}
                        selectedItem={selectedItem}
                        selectedUrl={selectedUrl}
                        status={status}
                    />
                </aside>
            </main>
        </div>
    )
}