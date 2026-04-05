interface IdleStateProps {
    title: string
    message: string
    detail?: string | null
    statusLabel: string
}

export function IdleState({ title, message, detail, statusLabel }: IdleStateProps) {
    return (
        <div className="player-idle" role="status">
            <span className="player-idle__label">{statusLabel}</span>
            <h1>{title}</h1>
            <p>{message}</p>
            {detail ? <p className="player-idle__detail">{detail}</p> : null}
        </div>
    )
}