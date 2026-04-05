import { useEffect, useRef } from 'react'
import { PlayListIcon } from '@hugeicons-pro/core-solid-standard'
import {
    formatBytes,
    formatDuration,
    formatOrientationLabel,
    formatPlaybackStatus,
    formatRelativeDate,
} from '../lib/format'
import { getDisplayDurationSeconds } from '../lib/media'
import type { MediaItem, Orientation, PlaybackStatus } from '../types/media'
import { Icon } from './Icon'

interface PreviewPanelProps {
    selectedItem: MediaItem | null
    selectedUrl: string | null
    selectedIndex: number
    currentItem: MediaItem | null
    currentUrl: string | null
    currentIndex: number
    playlistLength: number
    status: PlaybackStatus
    orientation: Orientation
    imageDurationSeconds: number
    onChangeImageDuration: (seconds: number) => void
    onChangeDurationOverride: (id: string, seconds: number | null) => void
    onSetCurrentItem: (index: number) => void
}

export function PreviewPanel({
    selectedItem,
    selectedUrl,
    selectedIndex,
    currentItem,
    currentUrl,
    currentIndex,
    playlistLength,
    status,
    orientation,
    imageDurationSeconds,
    onChangeImageDuration,
    onChangeDurationOverride,
    onSetCurrentItem,
}: PreviewPanelProps) {
    const previewStageClassName = `preview-stage preview-stage--${orientation}`
    const currentVideoRef = useRef<HTMLVideoElement | null>(null)

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
    }, [currentItem?.id, currentItem?.type, currentUrl, status])

    return (
        <div className="preview-panel">
            <section className="section-card sidebar-section">
                <div className="section-card__title">
                    <h2>En Emision</h2>
                    <p>Replica del contenido que el player tiene activo en este momento.</p>
                </div>

                <div className={previewStageClassName}>
                    {status !== 'stopped' && currentItem && currentUrl ? (
                        currentItem.type === 'image' ? (
                            <img alt={currentItem.name} src={currentUrl} />
                        ) : (
                            <video
                                key={currentItem.id}
                                muted
                                playsInline
                                preload="metadata"
                                ref={currentVideoRef}
                                src={currentUrl}
                            />
                        )
                    ) : (
                        <div className="preview-empty">
                            <Icon icon={PlayListIcon} size={30} />
                            <strong>Sin emision activa</strong>
                            <p>Cuando el player este reproduciendo, aqui veras el contenido en curso.</p>
                        </div>
                    )}
                </div>

                <div className="preview-live-summary">
                    <span className={`status-pill status-pill--${status}`}>{formatPlaybackStatus(status)}</span>
                    <span className="preview-live-summary__item">{currentItem?.name ?? 'Sin contenido activo'}</span>
                    <span className="preview-live-summary__position">
                        {playlistLength === 0 ? '-' : `${currentIndex + 1} / ${playlistLength}`}
                    </span>
                </div>
            </section>

            <section className="section-card sidebar-section">
                <div className="sidebar-section__header">
                    <h3>Item Seleccionado</h3>
                    <p>Informacion basica del elemento que estas revisando o por emitir.</p>
                </div>

                {selectedItem && selectedUrl ? (
                    <div className="preview-stage preview-stage--selection">
                        {selectedItem.type === 'image' ? (
                            <img alt={selectedItem.name} src={selectedUrl} />
                        ) : (
                            <video muted playsInline preload="metadata" src={selectedUrl} />
                        )}
                    </div>
                ) : null}

                {selectedItem ? (
                    <div className="sidebar-grid">
                        <div className="sidebar-grid__row">
                            <span className="sidebar-key">Nombre</span>
                            <span className="sidebar-value">{selectedItem.name}</span>
                        </div>
                        <div className="sidebar-grid__row">
                            <span className="sidebar-key">Tipo</span>
                            <span className="sidebar-value">
                                {selectedItem.type === 'image' ? 'Imagen' : 'Video'}
                            </span>
                        </div>
                        <div className="sidebar-grid__row">
                            <span className="sidebar-key">Peso</span>
                            <span className="sidebar-value">{formatBytes(selectedItem.size)}</span>
                        </div>
                        <div className="sidebar-grid__row">
                            <span className="sidebar-key">Duracion</span>
                            <span className="sidebar-value">
                                {formatDuration(getDisplayDurationSeconds(selectedItem, imageDurationSeconds))}
                            </span>
                        </div>
                        <div className="sidebar-grid__row">
                            <span className="sidebar-key">Alta</span>
                            <span className="sidebar-value">{formatRelativeDate(selectedItem.createdAt)}</span>
                        </div>
                    </div>
                ) : (
                    <p className="utility-note">No hay ningun item seleccionado.</p>
                )}

                {selectedItem && selectedIndex >= 0 ? (
                    <button className="ghost-button" onClick={() => onSetCurrentItem(selectedIndex)} type="button">
                        Usar como item actual
                    </button>
                ) : null}
            </section>

            <section className="section-card sidebar-section">
                <div className="sidebar-section__header">
                    <h3>Configuracion</h3>
                    <p>Parametros globales y override simple para imagenes.</p>
                </div>

                <div className="sidebar-form">
                    <div className="sidebar-form__row">
                        <label htmlFor="image-duration-default">Duracion por defecto para imagenes</label>
                        <input
                            className="number-input"
                            id="image-duration-default"
                            max={300}
                            min={3}
                            onChange={(event) => onChangeImageDuration(Number(event.target.value))}
                            step={1}
                            type="number"
                            value={imageDurationSeconds}
                        />
                    </div>

                    <div className="sidebar-grid__row">
                        <span className="sidebar-key">Orientacion</span>
                        <span className="sidebar-value">{formatOrientationLabel(orientation)}</span>
                    </div>

                    {selectedItem?.type === 'image' ? (
                        <div className="sidebar-form__row">
                            <label htmlFor="image-duration-override">Override del item seleccionado</label>
                            <input
                                className="number-input"
                                id="image-duration-override"
                                max={300}
                                min={3}
                                onChange={(event) => {
                                    const value = event.target.value
                                    onChangeDurationOverride(selectedItem.id, value === '' ? null : Number(value))
                                }}
                                placeholder="Usar valor global"
                                step={1}
                                type="number"
                                value={selectedItem.durationOverrideSeconds ?? ''}
                            />
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="section-card sidebar-section">
                <div className="sidebar-section__header">
                    <h3>Estado de reproduccion</h3>
                    <p>Resumen persistido compartido entre administracion y player.</p>
                </div>

                <div className="sidebar-grid">
                    <div className="sidebar-grid__row">
                        <span className="sidebar-key">Estado</span>
                        <span className={`status-pill status-pill--${status}`}>{formatPlaybackStatus(status)}</span>
                    </div>
                    <div className="sidebar-grid__row">
                        <span className="sidebar-key">Item actual</span>
                        <span className="sidebar-value">{currentItem?.name ?? 'Sin contenido activo'}</span>
                    </div>
                    <div className="sidebar-grid__row">
                        <span className="sidebar-key">Indice actual</span>
                        <span className="sidebar-value">
                            {playlistLength === 0 ? '-' : `${currentIndex + 1} / ${playlistLength}`}
                        </span>
                    </div>
                </div>
            </section>
        </div>
    )
}