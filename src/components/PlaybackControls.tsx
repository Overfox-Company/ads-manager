import {
    ArrowLeftIcon,
    ArrowRightIcon,
    FileImageIcon,
    FileVideoIcon,
    PauseIcon,
    PlayIcon,
    StopIcon,
    VolumeHighIcon,
    VolumeLowIcon,
    VolumeMute01Icon,
} from '@hugeicons-pro/core-solid-standard'
import { formatDuration, formatPlaybackStatus } from '../lib/format'
import type { MediaItem, PlaybackStatus } from '../types/media'
import { Icon } from './Icon'

interface PlaybackControlsProps {
    disabled: boolean
    status: PlaybackStatus
    currentItem: MediaItem | null
    currentUrl: string | null
    currentItemDurationLabel: string
    currentIndex: number
    playlistLength: number
    playbackTimeSeconds: number
    playbackTotalSeconds: number
    monitorVolume: number
    isMonitorMuted: boolean
    onPlay: () => void
    onPause: () => void
    onPrevious: () => void
    onNext: () => void
    onStop: () => void
    onSeek: (value: number) => void
    onVolumeChange: (value: number) => void
    onToggleMute: () => void
}

export function PlaybackControls({
    disabled,
    status,
    currentItem,
    currentUrl,
    currentItemDurationLabel,
    currentIndex,
    playlistLength,
    playbackTimeSeconds,
    playbackTotalSeconds,
    monitorVolume,
    isMonitorMuted,
    onPlay,
    onPause,
    onPrevious,
    onNext,
    onStop,
    onSeek,
    onVolumeChange,
    onToggleMute,
}: PlaybackControlsProps) {
    const currentPositionLabel =
        playlistLength === 0 ? 'Sin contenido' : `${currentIndex + 1} / ${playlistLength}`
    const volumeIcon = isMonitorMuted || monitorVolume === 0
        ? VolumeMute01Icon
        : monitorVolume < 55
            ? VolumeLowIcon
            : VolumeHighIcon

    return (
        <footer className="player-bar">
            <div className="player-bar__media">
                <div className="player-bar__thumb">
                    {currentItem && currentUrl ? (
                        currentItem.type === 'image' ? (
                            <img alt={currentItem.name} src={currentUrl} />
                        ) : (
                            <video aria-hidden="true" muted playsInline preload="metadata" src={currentUrl} />
                        )
                    ) : (
                        <div className="player-bar__thumb-placeholder" aria-hidden="true">
                            <Icon icon={currentItem?.type === 'image' ? FileImageIcon : FileVideoIcon} size={18} />
                        </div>
                    )}
                </div>

                <div className="player-bar__meta">
                    <strong>{currentItem?.name ?? 'Sin contenido activo'}</strong>
                    <div className="player-bar__meta-row">
                        <span>{currentItem ? (currentItem.type === 'image' ? 'Imagen' : 'Video') : 'Standby'}</span>
                        <span>{currentItemDurationLabel}</span>
                        <span>{currentPositionLabel}</span>
                    </div>
                </div>
            </div>

            <div className="player-bar__transport">
                <div className="transport-buttons" aria-label="Controles de reproduccion">
                    <button className="transport-button" disabled={disabled} onClick={onPrevious} type="button">
                        <Icon icon={ArrowLeftIcon} size={18} />
                    </button>

                    <button
                        aria-pressed={status === 'playing'}
                        className="transport-button transport-button--primary"
                        disabled={disabled}
                        onClick={onPlay}
                        type="button"
                    >
                        <Icon icon={PlayIcon} size={19} />
                    </button>

                    <button
                        aria-pressed={status === 'paused'}
                        className="transport-button"
                        disabled={disabled}
                        onClick={onPause}
                        type="button"
                    >
                        <Icon icon={PauseIcon} size={18} />
                    </button>

                    <button className="transport-button" disabled={disabled} onClick={onNext} type="button">
                        <Icon icon={ArrowRightIcon} size={18} />
                    </button>

                    <button className="transport-button transport-button--danger" disabled={disabled} onClick={onStop} type="button">
                        <Icon icon={StopIcon} size={18} />
                        <span>Finalizar</span>
                    </button>
                </div>

                <div className="progress-cluster" role="status" aria-live="polite">
                    <span className="progress-cluster__time">{formatDuration(playbackTimeSeconds)}</span>
                    <input
                        className="timeline-slider"
                        disabled={disabled || !currentItem || currentItem.type !== 'video' || playbackTotalSeconds <= 0}
                        max={playbackTotalSeconds || 0}
                        min={0}
                        onChange={(event) => onSeek(Number(event.target.value))}
                        step={0.1}
                        type="range"
                        value={Math.min(playbackTimeSeconds, playbackTotalSeconds || playbackTimeSeconds || 0)}
                    />
                    <span className="progress-cluster__time">{formatDuration(playbackTotalSeconds)}</span>
                </div>

                <div className="progress-cluster__status">
                    <span className={`live-pill live-pill--${status}`}>{formatPlaybackStatus(status)}</span>
                </div>
            </div>

            <div className="player-bar__volume">
                <button className="volume-button" onClick={onToggleMute} type="button">
                    <Icon icon={volumeIcon} size={18} />
                </button>

                <input
                    aria-label="Volumen del monitor"
                    className="volume-slider"
                    max={100}
                    min={0}
                    onChange={(event) => onVolumeChange(Number(event.target.value))}
                    step={1}
                    type="range"
                    value={isMonitorMuted ? 0 : monitorVolume}
                />

                <span className="player-bar__volume-value">{isMonitorMuted ? 'Mute' : `${monitorVolume}%`}</span>
            </div>
        </footer>
    )
}