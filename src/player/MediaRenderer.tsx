import { useEffect, useRef } from 'react'
import type { PlayerIssueReason, PlayerManifestItem } from '../types/network'

interface MediaRendererProps {
    item: PlayerManifestItem
    onReady: () => void
    onCompleted: () => void
    onFailure: (reason: PlayerIssueReason, detail: string) => void
}

export function MediaRenderer({ item, onReady, onCompleted, onFailure }: MediaRendererProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null)

    useEffect(() => {
        if (item.type !== 'video') {
            return
        }

        const video = videoRef.current

        if (!video) {
            return
        }

        const compatibility = item.mime ? video.canPlayType(item.mime) : ''

        if (!compatibility) {
            onFailure('unsupported', `El navegador reporta compatibilidad insuficiente para ${item.mime || 'video desconocido'}.`)
        }
    }, [item.id, item.mime, item.type, onFailure])

    if (item.type === 'image') {
        return (
            <div className="player-frame">
                <img
                    alt={item.name}
                    className="player-media"
                    loading="eager"
                    onError={() => onFailure('media-error', 'No se pudo cargar la imagen actual.')}
                    onLoad={onReady}
                    src={item.src}
                />
            </div>
        )
    }

    return (
        <div className="player-frame">
            <video
                autoPlay
                className="player-media"
                muted
                onCanPlay={(event) => {
                    onReady()
                    void event.currentTarget.play().catch((error) => {
                        onFailure(
                            'media-error',
                            error instanceof Error
                                ? error.message
                                : 'El navegador no pudo iniciar la reproduccion del video.',
                        )
                    })
                }}
                onEnded={onCompleted}
                onError={() => onFailure('media-error', 'El navegador reporto un error al reproducir el video.')}
                playsInline
                preload="metadata"
                ref={videoRef}
                src={item.src}
            />
        </div>
    )
}