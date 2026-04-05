import {
    ArrowLeftIcon,
    ArrowRightIcon,
    PauseIcon,
    PlayIcon,
    StopIcon,
} from '@hugeicons-pro/core-solid-standard'
import { formatPlaybackStatus } from '../lib/format'
import type { PlaybackStatus } from '../types/media'
import { Icon } from './Icon'

interface PlaybackControlsProps {
    disabled: boolean
    status: PlaybackStatus
    currentItemName: string | null
    currentIndex: number
    playlistLength: number
    onPlay: () => void
    onPause: () => void
    onPrevious: () => void
    onNext: () => void
    onStop: () => void
}

export function PlaybackControls({
    disabled,
    status,
    currentItemName,
    currentIndex,
    playlistLength,
    onPlay,
    onPause,
    onPrevious,
    onNext,
    onStop,
}: PlaybackControlsProps) {
    const currentPositionLabel =
        playlistLength === 0 ? 'Sin contenido' : `${currentIndex + 1} / ${playlistLength}`

    return (
        <div className="control-stack">
            <div className="control-group" aria-label="Controles de reproduccion">
                <button className="ghost-button" disabled={disabled} onClick={onPrevious} type="button">
                    <Icon icon={ArrowLeftIcon} />
                    <span className="button-label">Anterior</span>
                </button>

                <button
                    aria-pressed={status === 'playing'}
                    className={`control-button control-button--accent${status === 'playing' ? ' control-button--active control-button--active-playing' : ''}`}
                    disabled={disabled}
                    onClick={onPlay}
                    type="button"
                >
                    <Icon icon={PlayIcon} />
                    <span className="button-label">Play</span>
                </button>

                <button
                    aria-pressed={status === 'paused'}
                    className={`ghost-button${status === 'paused' ? ' control-button--active control-button--active-paused' : ''}`}
                    disabled={disabled}
                    onClick={onPause}
                    type="button"
                >
                    <Icon icon={PauseIcon} />
                    <span className="button-label">Pausa</span>
                </button>

                <button className="ghost-button" disabled={disabled} onClick={onNext} type="button">
                    <Icon icon={ArrowRightIcon} />
                    <span className="button-label">Siguiente</span>
                </button>

                <button
                    aria-pressed={status === 'stopped'}
                    className={`danger-button${status === 'stopped' ? ' control-button--active control-button--active-stopped' : ''}`}
                    disabled={disabled}
                    onClick={onStop}
                    type="button"
                >
                    <Icon icon={StopIcon} />
                    <span className="button-label">Finalizar</span>
                </button>
            </div>

            <div className="control-feedback" role="status" aria-live="polite">
                <span className={`control-feedback__dot control-feedback__dot--${status}`} />
                <span className="control-feedback__status">{formatPlaybackStatus(status)}</span>
                <span className="control-feedback__divider" aria-hidden="true">/</span>
                <span className="control-feedback__item">{currentItemName ?? 'Sin contenido activo'}</span>
                <span className="control-feedback__divider" aria-hidden="true">/</span>
                <span className="control-feedback__position">{currentPositionLabel}</span>
            </div>
        </div>
    )
}