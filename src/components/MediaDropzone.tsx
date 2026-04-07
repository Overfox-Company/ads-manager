import { useEffect, useState, type ReactNode } from 'react'
import { useDropzone } from 'react-dropzone'
import { FolderUploadIcon } from '@hugeicons-pro/core-solid-standard'
import { formatBytes } from '../lib/format'
import { Icon } from './Icon'
import type { UploadProgressInfo } from '../lib/serverApi'

const UPLOAD_NOTICE_FADE_DELAY_MS = 900
const UPLOAD_NOTICE_FADE_DURATION_MS = 240

interface UploadStatus {
    phase: 'idle' | 'preparing' | 'uploading' | 'processing' | 'complete'
    progress: UploadProgressInfo | null
    detail: string | null
}

interface MediaDropzoneProps {
    activeFilter: 'all' | 'video' | 'image'
    filterCounts: Record<'all' | 'video' | 'image', number>
    itemCount: number
    isBusy: boolean
    onFilterChange: (filter: 'all' | 'video' | 'image') => void
    selectedFiles: string[]
    uploadErrorMessage: string | null
    uploadStatus: UploadStatus
    uploadWarningMessages: string[]
    onFilesAccepted: (files: File[]) => Promise<void> | void
    children: ReactNode
}

export function MediaDropzone({
    activeFilter,
    filterCounts,
    itemCount,
    isBusy,
    onFilterChange,

    selectedFiles,
    uploadErrorMessage,
    uploadStatus,
    uploadWarningMessages,
    onFilesAccepted,
    children,
}: MediaDropzoneProps) {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isUploadNoticeMounted, setIsUploadNoticeMounted] = useState(false)
    const [isUploadNoticeVisible, setIsUploadNoticeVisible] = useState(false)

    const uploadTitle = uploadStatus.phase === 'preparing'
        ? `Preparando ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}...`
        : uploadStatus.phase === 'uploading'
            ? `Subiendo ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}...`
            : uploadStatus.phase === 'processing'
                ? 'Subida completa. Guardando version nativa...'
                : uploadStatus.phase === 'complete'
                    ? `Carga completada: ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}`
                    : null

    useEffect(() => {
        if (uploadStatus.phase === 'idle') {
            setIsUploadNoticeMounted(false)
            setIsUploadNoticeVisible(false)

            return undefined
        }

        setIsUploadNoticeMounted(true)
        setIsUploadNoticeVisible(true)

        if (uploadStatus.phase !== 'complete') {
            return undefined
        }

        const fadeTimeoutId = window.setTimeout(() => {
            setIsUploadNoticeVisible(false)
        }, UPLOAD_NOTICE_FADE_DELAY_MS)

        const unmountTimeoutId = window.setTimeout(() => {
            setIsUploadNoticeMounted(false)
        }, UPLOAD_NOTICE_FADE_DELAY_MS + UPLOAD_NOTICE_FADE_DURATION_MS)

        return () => {
            window.clearTimeout(fadeTimeoutId)
            window.clearTimeout(unmountTimeoutId)
        }
    }, [uploadStatus.phase])

    const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
        accept: {
            'image/*': [],
            'video/*': [],
        },
        multiple: true,
        noClick: true,
        onDropAccepted: (files) => {
            setErrorMessage(null)
            void onFilesAccepted(files)
        },
        onDropRejected: () => {
            setErrorMessage('Solo se admiten imagenes y videos compatibles del equipo local.')
        },
    })

    return (
        <section
            {...getRootProps()}
            //   style={{ borderRight: isDragActive ? '2px dashed var(--primary)' : `1px solid  rgb(126, 126, 126)` }}
            className={`panel library-panel${isDragActive ? ' library-panel--drag-active' : ''}`}
        >
            <input {...getInputProps()} />

            <div className="panel-header library-panel__header">
                <div className="panel-title-group">
                    <span className="panel-eyebrow">Biblioteca</span>

                </div>

                <button
                    className="secondary-button"
                    disabled={isBusy}
                    onClick={(event) => {
                        event.stopPropagation()
                        open()
                    }}
                    type="button"
                >
                    {isBusy ? 'Cargando...' : 'Agregar archivos'}
                </button>
            </div>

            <div className="library-panel__toolbar">
                <div className="filter-chip-group" role="tablist" aria-label="Filtro de biblioteca">
                    <button
                        className={`filter-chip${activeFilter === 'all' ? ' filter-chip--active' : ''}`}
                        onClick={(event) => {
                            event.stopPropagation()
                            onFilterChange('all')
                        }}
                        type="button"
                    >
                        All
                        <span>{filterCounts.all}</span>
                    </button>

                    <button
                        className={`filter-chip${activeFilter === 'video' ? ' filter-chip--active' : ''}`}
                        onClick={(event) => {
                            event.stopPropagation()
                            onFilterChange('video')
                        }}
                        type="button"
                    >
                        Videos
                        <span>{filterCounts.video}</span>
                    </button>

                    <button
                        className={`filter-chip${activeFilter === 'image' ? ' filter-chip--active' : ''}`}
                        onClick={(event) => {
                            event.stopPropagation()
                            onFilterChange('image')
                        }}
                        type="button"
                    >
                        Imagenes
                        <span>{filterCounts.image}</span>
                    </button>
                </div>

                <p className="library-panel__meta">
                    {itemCount === 0
                        ? 'Sin contenido cargado todavia.'
                        : `${itemCount} elementos persistidos localmente.`}
                </p>
            </div>

            <div className="library-drop-card">
                <div className="library-drop-card__icon" aria-hidden="true">
                    <Icon icon={FolderUploadIcon} size={20} />
                </div>

                <div className="library-drop-card__copy">
                    <strong>Dropzone activo en toda la biblioteca</strong>
                </div>
            </div>





            {errorMessage ? <p className="dropzone__error">{errorMessage}</p> : null}
            {uploadErrorMessage ? <p className="dropzone__error">{uploadErrorMessage}</p> : null}
            {uploadWarningMessages.length > 0 ? (
                <div className="dropzone__warnings">
                    {uploadWarningMessages.map((warning) => (
                        <p key={warning} className="utility-note">
                            {warning}
                        </p>
                    ))}
                </div>
            ) : null}

            <div className="library-panel__content">{children}</div>

            {isDragActive ? (
                <div className="library-panel__overlay" aria-hidden="true">
                    <div className="library-panel__overlay-card">
                        <strong>Suelta archivos para agregarlos a la playlist</strong>
                        <span>Videos e imagenes compatibles se suben y quedan disponibles para toda la red.</span>
                    </div>
                </div>
            ) : null}

            {isUploadNoticeMounted && uploadTitle ? (
                <div className={`library-notice${isUploadNoticeVisible ? '' : ' library-notice--fading'}`}>
                    <p className="library-notice__title">{uploadTitle}</p>

                    {uploadStatus.detail ? <p className="library-notice__detail">{uploadStatus.detail}</p> : null}

                    {uploadStatus.progress ? (
                        <>
                            <div aria-hidden="true" className="upload-progress-bar">
                                <div className="upload-progress-bar__fill" style={{ width: `${uploadStatus.progress.percent}%` }} />
                            </div>

                            <div className="upload-progress-meta">
                                <span>{uploadStatus.progress.percent}%</span>
                                <span>
                                    {formatBytes(uploadStatus.progress.loaded)} / {formatBytes(uploadStatus.progress.total)}
                                </span>
                            </div>
                        </>
                    ) : null}

                    <ul className="library-notice__list">
                        {selectedFiles.map((fileName) => (
                            <li key={fileName}>{fileName}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    )
}