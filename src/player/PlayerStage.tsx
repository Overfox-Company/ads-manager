import type { PropsWithChildren } from 'react'
import type { Orientation } from '../types/media'

interface PlayerStageProps extends PropsWithChildren {
    orientation: Orientation
}

export function PlayerStage({ orientation, children }: PlayerStageProps) {
    return (
        <div className="player-shell">
            <div className={`player-stage player-stage--${orientation}`}>
                <div className="player-stage__viewport">
                    <div className="player-stage__content">{children}</div>
                </div>
            </div>
        </div>
    )
}