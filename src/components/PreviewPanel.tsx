import { useEffect, type RefObject, type SyntheticEvent } from 'react'
import { FileImageIcon, FileVideoIcon, PlayListIcon } from '@hugeicons-pro/core-solid-standard'
import { formatDuration, formatOrientationLabel, formatPlaybackStatus } from '../lib/format'
import { getDisplayDurationSeconds } from '../lib/media'
import type { MediaItem, Orientation, PlaybackStatus } from '../types/media'
import { Icon } from './Icon'

interface PreviewPanelProps {
    currentItem: MediaItem | null
    currentUrl: string | null
    currentIndex: number
    playlistLength: number
    status: PlaybackStatus
    orientation: Orientation
    imageDurationSeconds: number
    currentVideoRef: RefObject<HTMLVideoElement | null>
    onVideoTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void
    onVideoLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void
    onVideoDurationChange: (event: SyntheticEvent<HTMLVideoElement>) => void
    onVideoVolumeChange: (event: SyntheticEvent<HTMLVideoElement>) => void
}

export function PreviewPanel({
    currentItem,
    currentUrl,
    currentIndex,
    playlistLength,
    status,
    orientation,
    imageDurationSeconds,
    currentVideoRef,
    onVideoTimeUpdate,
    onVideoLoadedMetadata,
    onVideoDurationChange,
    onVideoVolumeChange,
}: PreviewPanelProps) {
    const previewStageClassName = `stage-surface stage-surface--${orientation}`

    useEffect(() => {
        const video = currentVideoRef.current

        if (!video || currentItem?.type !== 'video') {
            return
        }

        if (status === 'playing') {
            void video.play().catch(() => undefined)
            return
        }

        video.pause()
    }, [currentItem?.id, currentItem?.type, currentUrl, currentVideoRef, status])

    return (
        <section className="panel stage-panel">
            <div className="panel-header stage-panel__header">
                <div className="panel-title-group">
                    <span className="panel-eyebrow">En emision</span>
                    <h2 className="panel-title panel-title--stage">{currentItem?.name ?? 'Esperando reproduccion'}</h2>
                    <p className="panel-description">
                        Monitor principal de la senal activa con foco en el contenido que se esta emitiendo.
                    </p>
                </div>

                <div className="stage-panel__meta">
                    <span className={`live-pill live-pill--${status}`}>{formatPlaybackStatus(status)}</span>
                    <span className="stage-panel__position">
                        {playlistLength === 0 ? 'Playlist vacia' : `Item ${currentIndex + 1} de ${playlistLength}`}
                    </span>
                </div>
            </div>

            <div className={previewStageClassName}>
                <div className="stage-surface__screen">
                    {status !== 'stopped' && currentItem && currentUrl ? (
                        currentItem.type === 'image' ? (
                            <img alt={currentItem.name} src={currentUrl} />
                        ) : (
                            <video
                                controls={false}
                                key={currentItem.id}
                                onDurationChange={onVideoDurationChange}
                                onLoadedMetadata={onVideoLoadedMetadata}
                                onTimeUpdate={onVideoTimeUpdate}
                                onVolumeChange={onVideoVolumeChange}
                                playsInline
                                preload="metadata"
                                ref={currentVideoRef}
                                src={currentUrl}
                            />
                        )
                    ) : (
                        <div className="preview-empty preview-empty--stage">
                            <Icon icon={PlayListIcon} size={30} />
                            <strong>No hay contenido activo</strong>
                            <p>Cuando el sistema reciba una orden de reproduccion, la senal aparecera aqui.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="stage-facts">
                <div className="stage-fact">
                    <span className="stage-fact__label">Tipo</span>
                    <span className="stage-fact__value">
                        {currentItem ? (
                            <>
                                <Icon icon={currentItem.type === 'image' ? FileImageIcon : FileVideoIcon} size={14} />
                                <span>{currentItem.type === 'image' ? 'Imagen' : 'Video'}</span>
                            </>
                        ) : (
                            'Sin dato'
                        )}
                    </span>
                </div>

                <div className="stage-fact">
                    <span className="stage-fact__label">Duracion</span>
                    <span className="stage-fact__value">
                        {currentItem ? formatDuration(getDisplayDurationSeconds(currentItem, imageDurationSeconds)) : 'Sin dato'}
                    </span>
                </div>

                <div className="stage-fact">
                    <span className="stage-fact__label">Orientacion</span>
                    <span className="stage-fact__value">{formatOrientationLabel(orientation)}</span>
                </div>

                <div className="stage-fact">
                    <span className="stage-fact__label">Estado</span>
                    <span className="stage-fact__value">{formatPlaybackStatus(status)}</span>
                </div>
            </div>
        </section>
    )
}