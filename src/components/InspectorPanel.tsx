import {
    ComputerVideoIcon,
    FileImageIcon,
    FileVideoIcon,
    Settings01Icon,
} from '@hugeicons-pro/core-solid-standard'
import { Link } from 'react-router-dom'
import { PLAYBACK_PROFILE_DEFINITIONS, getPlaybackProfileDefinition } from '../lib/playbackProfiles'
import { formatBytes, formatDuration, formatOrientationLabel, formatPlaybackStatus, formatRelativeDate } from '../lib/format'
import { ORIENTATION_OPTIONS, getDisplayDurationSeconds } from '../lib/media'
import type { MediaItem, Orientation, PlaybackProfileId, PlaybackStatus } from '../types/media'
import type { PlaybackTelemetryReport } from '../types/network'
import { Icon } from './Icon'

interface InspectorPanelProps {
    selectedItem: MediaItem | null
    selectedUrl: string | null
    selectedIndex: number
    currentItem: MediaItem | null
    currentIndex: number
    playlistLength: number
    status: PlaybackStatus
    orientation: Orientation
    imageDurationSeconds: number
    playbackProfile: PlaybackProfileId
    lastPlaybackReport: PlaybackTelemetryReport | null
    onOrientationChange: (orientation: Orientation) => void
    onPlaybackProfileChange: (profile: PlaybackProfileId) => void
    onChangeImageDuration: (seconds: number) => void
    onChangeDurationOverride: (id: string, seconds: number | null) => void
    onSetCurrentItem: (index: number) => void
}

export function InspectorPanel({
    selectedItem,
    selectedUrl,
    selectedIndex,
    currentItem,
    currentIndex,
    playlistLength,
    status,
    orientation,
    imageDurationSeconds,
    playbackProfile,
    lastPlaybackReport,
    onOrientationChange,
    onPlaybackProfileChange,
    onChangeImageDuration,
    onChangeDurationOverride,
    onSetCurrentItem,
}: InspectorPanelProps) {
    const selectedPlaybackProfile = getPlaybackProfileDefinition(playbackProfile)
    const playbackDiagnostics = lastPlaybackReport && currentItem?.id === lastPlaybackReport.itemId
        ? lastPlaybackReport
        : null

    return (
        <aside className="panel inspector-panel">
            <div className="panel-header inspector-panel__header">
                <div className="panel-title-group">
                    <span className="panel-eyebrow">Configuracion</span>
                    <h2 className="panel-title">Inspector de emision</h2>
                    <p className="panel-description">
                        Ajustes globales, metadatos y acceso rapido al player remoto.
                    </p>
                </div>

                <Link className="panel-link" target="_blank" to="/player">
                    <Icon icon={ComputerVideoIcon} size={18} />
                    <span>Abrir player</span>
                </Link>
            </div>

            <section className="inspector-group">
                <div className="inspector-group__label">
                    <Icon icon={Settings01Icon} size={16} />
                    <span>Orientacion</span>
                </div>

                <div className="segmented-control" role="group" aria-label="Orientacion global">
                    {ORIENTATION_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            aria-pressed={option.value === orientation}
                            className={`segmented-control__button${option.value === orientation ? ' segmented-control__button--active' : ''}`}
                            onClick={() => onOrientationChange(option.value)}
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <p className="inspector-help">Define como se renderiza el contenido en la pantalla remota.</p>
            </section>

            <section className="inspector-group">
                <div className="inspector-group__label">
                    <span>Perfil de reproduccion</span>
                </div>

                <div className="profile-option-list" role="radiogroup" aria-label="Perfil de reproduccion">
                    {PLAYBACK_PROFILE_DEFINITIONS.map((profile) => (
                        <button
                            key={profile.id}
                            aria-checked={profile.id === playbackProfile}
                            className={`profile-option${profile.id === playbackProfile ? ' profile-option--active' : ''}`}
                            onClick={() => onPlaybackProfileChange(profile.id)}
                            role="radio"
                            type="button"
                        >
                            <div className="profile-option__header">
                                <strong>{profile.label}</strong>
                                <span className={`profile-badge profile-badge--${profile.badge}`}>
                                    {profile.badge === 'recommended'
                                        ? 'Recomendado'
                                        : profile.badge === 'modern'
                                            ? 'Moderno'
                                            : profile.badge === 'premium'
                                                ? 'Premium'
                                                : profile.badge === 'experimental'
                                                    ? 'Experimental'
                                                    : 'Seguro'}
                                </span>
                            </div>

                            <p>{profile.description}</p>
                            <div className="profile-option__meta">
                                <span>{profile.technicalSummary}</span>
                                <span>{profile.compatibilityLabel}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <p className="inspector-help">
                    Cambio aplicado inmediatamente al item actual. Si la variante elegida no existe o falla, el player baja al siguiente perfil seguro.
                </p>

                {selectedPlaybackProfile.compatibilityWarning ? (
                    <div className="inspector-inline-alert inspector-inline-alert--warning">
                        {selectedPlaybackProfile.compatibilityWarning}
                    </div>
                ) : null}
            </section>

            <section className="inspector-group">
                <div className="inspector-group__label">
                    <span>Diagnostico de reproduccion</span>
                </div>

                {currentItem?.type === 'video' ? (
                    playbackDiagnostics ? (
                        <>
                            <div className="inspector-metadata">
                                <div className="inspector-metadata__row">
                                    <span>Perfil solicitado</span>
                                    <span>{getPlaybackProfileDefinition(playbackDiagnostics.requestedProfile).label}</span>
                                </div>
                                <div className="inspector-metadata__row">
                                    <span>Perfil reproducido</span>
                                    <span>{playbackDiagnostics.resolvedProfile ? getPlaybackProfileDefinition(playbackDiagnostics.resolvedProfile).label : 'Sin resolver'}</span>
                                </div>
                                <div className="inspector-metadata__row">
                                    <span>Codec real</span>
                                    <span>{playbackDiagnostics.videoCodec ? playbackDiagnostics.videoCodec.toUpperCase() : 'Sin dato'}</span>
                                </div>
                                <div className="inspector-metadata__row">
                                    <span>Resolucion</span>
                                    <span>
                                        {playbackDiagnostics.width && playbackDiagnostics.height
                                            ? `${playbackDiagnostics.width} x ${playbackDiagnostics.height}`
                                            : 'Sin dato'}
                                    </span>
                                </div>
                                <div className="inspector-metadata__row">
                                    <span>FPS real</span>
                                    <span>{playbackDiagnostics.fps ? `${playbackDiagnostics.fps} fps` : 'Sin dato'}</span>
                                </div>
                                <div className="inspector-metadata__row">
                                    <span>Bitrate estimado</span>
                                    <span>{playbackDiagnostics.bitrateKbps ? `${playbackDiagnostics.bitrateKbps} kbps` : 'Sin dato'}</span>
                                </div>
                            </div>

                            {playbackDiagnostics.reason ? (
                                <div className={`inspector-inline-alert${playbackDiagnostics.didFallback ? ' inspector-inline-alert--danger' : ''}`}>
                                    {playbackDiagnostics.reason}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="inspector-empty">
                            <strong>Sin telemetria de variante.</strong>
                            <p>El player informara aqui el perfil realmente reproducido cuando cargue el video actual.</p>
                        </div>
                    )
                ) : (
                    <div className="inspector-empty">
                        <strong>El item actual no es un video.</strong>
                        <p>Los perfiles de reproduccion y el fallback solo aplican cuando el contenido en emision es video.</p>
                    </div>
                )}
            </section>

            <section className="inspector-group">
                <div className="inspector-field">
                    <label className="inspector-field__label" htmlFor="image-duration-default">
                        Duracion por defecto para imagenes
                    </label>

                    <div className="number-field">
                        <input
                            className="number-field__input"
                            id="image-duration-default"
                            max={300}
                            min={3}
                            onChange={(event) => {
                                const nextValue = Number(event.target.value)

                                if (Number.isFinite(nextValue)) {
                                    onChangeImageDuration(nextValue)
                                }
                            }}
                            step={1}
                            type="number"
                            value={imageDurationSeconds}
                        />
                        <span className="number-field__suffix">seg</span>
                    </div>
                </div>

                {selectedItem?.type === 'image' ? (
                    <div className="inspector-field">
                        <label className="inspector-field__label" htmlFor="image-duration-override">
                            Override del item seleccionado
                        </label>

                        <div className="number-field">
                            <input
                                className="number-field__input"
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
                            <span className="number-field__suffix">seg</span>
                        </div>
                    </div>
                ) : null}
            </section>

            <section className="inspector-group inspector-group--selected">
                <div className="inspector-group__label">
                    <span>Item seleccionado</span>
                </div>

                {selectedItem ? (
                    <>
                        <div className="selected-card">
                            <div className="selected-card__preview">
                                {selectedUrl ? (
                                    selectedItem.type === 'image' ? (
                                        <img alt={selectedItem.name} src={selectedUrl} />
                                    ) : (
                                        <video muted playsInline preload="metadata" src={selectedUrl} />
                                    )
                                ) : (
                                    <div className="selected-card__fallback" aria-hidden="true">
                                        <Icon icon={selectedItem.type === 'image' ? FileImageIcon : FileVideoIcon} size={18} />
                                    </div>
                                )}
                            </div>

                            <div className="selected-card__content">
                                <strong>{selectedItem.name}</strong>
                                <div className="selected-card__meta">
                                    <span>{selectedItem.type === 'image' ? 'Imagen' : 'Video'}</span>
                                    <span>{formatDuration(getDisplayDurationSeconds(selectedItem, imageDurationSeconds))}</span>
                                </div>
                            </div>
                        </div>

                        <div className="inspector-metadata">
                            <div className="inspector-metadata__row">
                                <span>Mime</span>
                                <span>{selectedItem.mimeType}</span>
                            </div>
                            <div className="inspector-metadata__row">
                                <span>Peso</span>
                                <span>{formatBytes(selectedItem.size)}</span>
                            </div>
                            <div className="inspector-metadata__row">
                                <span>Alta</span>
                                <span>{formatRelativeDate(selectedItem.createdAt)}</span>
                            </div>
                            <div className="inspector-metadata__row">
                                <span>Orientacion activa</span>
                                <span>{formatOrientationLabel(orientation)}</span>
                            </div>
                            {selectedItem.type === 'video' ? (
                                <div className="inspector-metadata__row">
                                    <span>Variantes</span>
                                    <span>{selectedItem.variants.length}</span>
                                </div>
                            ) : null}
                        </div>

                        {selectedIndex >= 0 ? (
                            <button className="secondary-button secondary-button--full" onClick={() => onSetCurrentItem(selectedIndex)} type="button">
                                Usar como item actual
                            </button>
                        ) : null}
                    </>
                ) : (
                    <div className="inspector-empty">
                        <strong>No hay un item seleccionado.</strong>
                        <p>Selecciona una pieza de la biblioteca para revisar su metadata y fijarla como actual.</p>
                    </div>
                )}
            </section>

            <section className="inspector-group">
                <div className="inspector-group__label">
                    <span>Resumen de emision</span>
                </div>

                <div className="inspector-metadata">
                    <div className="inspector-metadata__row">
                        <span>Estado</span>
                        <span className={`live-pill live-pill--${status}`}>{formatPlaybackStatus(status)}</span>
                    </div>
                    <div className="inspector-metadata__row">
                        <span>En emision</span>
                        <span>{currentItem?.name ?? 'Sin contenido activo'}</span>
                    </div>
                    <div className="inspector-metadata__row">
                        <span>Posicion</span>
                        <span>{playlistLength === 0 ? '-' : `${currentIndex + 1} / ${playlistLength}`}</span>
                    </div>
                </div>
            </section>
        </aside>
    )
}