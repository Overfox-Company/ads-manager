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

interface PlaylistEntry {
    item: MediaItem
    originalIndex: number
}

interface PlaylistTableProps {
    entries: PlaylistEntry[]
    totalCount: number
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
    entries,
    totalCount,
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

    if (entries.length === 0) {
        return (
            <div className="empty-state empty-state--library">
                <Icon icon={FileImageIcon} size={24} />
                <strong>{totalCount === 0 ? 'La biblioteca esta vacia' : 'No hay resultados para este filtro'}</strong>
                <p>
                    {totalCount === 0
                        ? 'Carga imagenes o videos para empezar a programar la reproduccion local.'
                        : 'Cambia el filtro o agrega nuevos contenidos para completar la playlist.'}
                </p>
            </div>
        )
    }

    return (
        <div className="playlist-wrap">
            <div className="playlist-list" role="list">
                {entries.map(({ item, originalIndex }) => {
                    const src = mediaUrls[item.id]
                    const isSelected = selectedItemId === item.id
                    const isCurrent = currentIndex === originalIndex

                    return (
                        <div
                            key={item.id}
                            className={`playlist-item${isSelected ? ' playlist-item--selected' : ''}${isCurrent ? ' playlist-item--current' : ''}${dropTargetIndex === originalIndex ? ' playlist-item--drop-target' : ''}`}
                            onClick={() => onSelect(item.id)}
                            onDragLeave={() => setDropTargetIndex((current) => (current === originalIndex ? null : current))}
                            onDragOver={(event) => handleDragOver(event, originalIndex)}
                            onDrop={(event) => handleDrop(event, originalIndex)}
                            onKeyDown={(event) => handleRowKeyDown(event, item.id)}
                            role="listitem"
                            tabIndex={0}
                        >
                            <button
                                className="playlist-item__drag"
                                draggable
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={(event) => event.stopPropagation()}
                                onDragEnd={() => {
                                    setDraggedIndex(null)
                                    setDropTargetIndex(null)
                                }}
                                onDragStart={(event) => handleDragStart(event, originalIndex)}
                                type="button"
                            >
                                <span className="sr-only">Reordenar</span>
                                <Icon icon={MoveIcon} size={16} />
                                { /* <span className="playlist-item__index">#{originalIndex + 1}</span> */}
                            </button>

                            <div className="playlist-item__thumb">
                                <MediaThumbnail item={item} src={src} />
                            </div>

                            <div className="playlist-item__content">
                                <div className="playlist-item__title-row">

                                    <strong>{item.name}</strong>
                                </div>

                                <div className="playlist-item__meta">



                                    {                                /*    <span className="playlist-badge">{item.type === 'image' ? 'Imagen' : 'Video'}</span>*/}

                                    { /* <span>{formatBytes(item.size)}</span> */}
                                    <span>{formatDuration(getDisplayDurationSeconds(item, imageDurationSeconds))}</span>


                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', }}>
                                        <button

                                            className="icon-button"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                onPlayIndex(originalIndex)
                                            }}
                                            title="Reproducir desde este item"
                                            type="button"
                                        >
                                            <Icon icon={PlayIcon} size={16} />
                                        </button>

                                        <button
                                            className="icon-button icon-button--danger"
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


                                    {  /*     <span>{item.mimeType}</span> */}
                                </div>


                            </div>

                        </div>
                    )
                })}
            </div>

            {draggedIndex !== null ? <p className="utility-note">Reordenando elemento #{draggedIndex + 1}.</p> : null}
        </div>
    )
}