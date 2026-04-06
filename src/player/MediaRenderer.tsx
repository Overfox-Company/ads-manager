import { useEffect, useRef } from 'react'
import type { PlayerIssueReason, PlayerManifestItem, PlayerManifestVariant } from '../types/network'

interface MediaRendererProps {
    item: PlayerManifestItem
    variant?: PlayerManifestVariant | null
    onReady: () => void
    onCompleted: () => void
    onFailure: (reason: PlayerIssueReason, detail: string) => void
}

export function MediaRenderer({ item, variant, onReady, onCompleted, onFailure }: MediaRendererProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null)

    useEffect(() => {
        if (item.type !== 'video' || !variant) {
            return
        }

        const video = videoRef.current

        if (!video) {
            return
        }

        const compatibility = variant.mimeType ? video.canPlayType(variant.mimeType) : ''

        if (!compatibility) {
            onFailure('unsupported', `El navegador reporta compatibilidad insuficiente para ${variant.mimeType || 'video desconocido'}.`)
        }
    }, [item.id, item.type, onFailure, variant])

    if (item.type === 'image') {
        return (
            <div className="player-frame">
                <img
                    alt={item.name}
                    className="player-media"
                    loading="eager"
                    onError={() => onFailure('media-error', 'No se pudo cargar la imagen actual.')}
                    onLoad={onReady}
                    src={item.src ?? ''}
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
                src={variant?.src ?? ''}
            />
        </div>
    )
}