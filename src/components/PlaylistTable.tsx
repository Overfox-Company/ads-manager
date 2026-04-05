import { useState, type DragEvent, type KeyboardEvent } from 'react'
import {
    FileImageIcon,
    FileRemoveIcon,
    FileVideoIcon,
    MoveIcon,
    PlayIcon,
} from '@hugeicons-pro/core-solid-standard'
import { formatDuration } from '../lib/format'
import { getDisplayDurationSeconds } from '../lib/media'
import type { MediaItem } from '../types/media'
import { Icon } from './Icon'

interface PlaylistTableProps {
    items: MediaItem[]
    mediaUrls: Record<string, string>
    currentIndex: number
    selectedItemId: string | null
    imageDurationSeconds: number
    onMove: (fromIndex: number, toIndex: number) => void
    onRemove: (id: string) => void
    onSelect: (id: string) => void
    onPlayIndex: (index: number) => void
}

function MediaThumbnail({ item, src }: { item: MediaItem; src?: string }) {
    if (!src) {
        return (
            <div className="playlist-thumb__placeholder" aria-hidden="true">
                <Icon icon={item.type === 'image' ? FileImageIcon : FileVideoIcon} size={18} />
            </div>
        )
    }

    if (item.type === 'image') {
        return <img alt="" src={src} />
    }

    return <video aria-hidden="true" muted playsInline preload="metadata" src={src} />
}

export function PlaylistTable({
    items,
    mediaUrls,
    currentIndex,
    selectedItemId,
    imageDurationSeconds,
    onMove,
    onRemove,
    onSelect,
    onPlayIndex,
}: PlaylistTableProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

    const handleRowKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
        itemId: string,
    ) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(itemId)
        }
    }

    const handleDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
        setDraggedIndex(index)
    }

    const handleDragOver = (event: DragEvent<HTMLElement>, index: number) => {
        event.preventDefault()

        if (index !== dropTargetIndex) {
            setDropTargetIndex(index)
        }
    }

    const handleDrop = (event: DragEvent<HTMLElement>, index: number) => {
        event.preventDefault()
        const sourceIndex = Number(event.dataTransfer.getData('text/plain'))

        if (Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex !== index) {
            onMove(sourceIndex, index)
        }

        setDraggedIndex(null)
        setDropTargetIndex(null)
    }

    if (items.length === 0) {
        return (
            <div className="empty-state">
                <Icon icon={FileImageIcon} size={24} />
                <strong>La playlist esta vacia</strong>
                <p>Carga imagenes o videos para empezar a programar la reproduccion local.</p>
            </div>
        )
    }

    return (
        <div className="playlist-wrap">
            <div className="playlist-header" role="row">
                <span>Drag</span>
                <span>#</span>
                <span>Thumb</span>
                <span>Archivo</span>
                <span>Tipo</span>
                <span>Duracion</span>
                <span>Acciones</span>
            </div>

            <div className="playlist-list">
                {items.map((item, index) => {
                    const src = mediaUrls[item.id]
                    const isSelected = selectedItemId === item.id
                    const isCurrent = currentIndex === index

                    return (
                        <div
                            key={item.id}
                            className={`playlist-row${isSelected ? ' playlist-row--selected' : ''}${dropTargetIndex === index ? ' playlist-row--drop-target' : ''
                                }`}
                            onClick={() => onSelect(item.id)}
                            onDragLeave={() => setDropTargetIndex((current) => (current === index ? null : current))}
                            onDragOver={(event) => handleDragOver(event, index)}
                            onDrop={(event) => handleDrop(event, index)}
                            onKeyDown={(event) => handleRowKeyDown(event, item.id)}
                            role="button"
                            tabIndex={0}
                        >
                            <button
                                className="drag-handle"
                                draggable
                                onClick={(event) => event.stopPropagation()}
                                onDragEnd={() => {
                                    setDraggedIndex(null)
                                    setDropTargetIndex(null)
                                }}
                                onDragStart={(event) => handleDragStart(event, index)}
                                type="button"
                            >
                                <span className="sr-only">Reordenar</span>
                                <Icon icon={MoveIcon} size={16} />
                            </button>

                            <div className="playlist-row__index">{index + 1}.</div>

                            <div className="playlist-row__thumb">
                                <MediaThumbnail item={item} src={src} />
                            </div>

                            <div className="playlist-row__main">
                                <div className="playlist-row__title">
                                    <strong>{item.name}</strong>
                                    {isCurrent ? <span className="current-badge">Actual</span> : null}
                                </div>

                                <div className="playlist-row__meta">
                                    <span>{item.mimeType}</span>
                                </div>
                            </div>

                            <div className="playlist-row__type type-pill">
                                {item.type === 'image' ? 'Imagen' : 'Video'}
                            </div>

                            <div className="playlist-row__duration playlist-row__meta">
                                <span>{formatDuration(getDisplayDurationSeconds(item, imageDurationSeconds))}</span>
                            </div>

                            <div className="playlist-row__actions">
                                <button
                                    className="row-action"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onPlayIndex(index)
                                    }}
                                    title="Reproducir desde este item"
                                    type="button"
                                >
                                    <Icon icon={PlayIcon} size={16} />
                                </button>

                                <button
                                    className="row-action row-action--danger"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onRemove(item.id)
                                    }}
                                    title="Eliminar item"
                                    type="button"
                                >
                                    <Icon icon={FileRemoveIcon} size={16} />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {draggedIndex !== null ? <p className="utility-note">Reordenando elemento {draggedIndex + 1}.</p> : null}
        </div>
    )
}