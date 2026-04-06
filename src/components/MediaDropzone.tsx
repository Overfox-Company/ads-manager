import { useState, type ReactNode } from 'react'
import { useDropzone } from 'react-dropzone'
import { FolderUploadIcon } from '@hugeicons-pro/core-solid-standard'
import { RECOMMENDED_SIGNAGE_VIDEO_PROFILE } from '../lib/mediaPolicy'
import { Icon } from './Icon'

interface MediaDropzoneProps {
    activeFilter: 'all' | 'video' | 'image'
    filterCounts: Record<'all' | 'video' | 'image', number>
    itemCount: number
    isBusy: boolean
    onFilterChange: (filter: 'all' | 'video' | 'image') => void
    selectedFiles: string[]
    uploadErrorMessage: string | null
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
    uploadWarningMessages,
    onFilesAccepted,
    children,
}: MediaDropzoneProps) {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
            className={`panel library-panel${isDragActive ? ' library-panel--drag-active' : ''}`}
        >
            <input {...getInputProps()} />

            <div className="panel-header library-panel__header">
                <div className="panel-title-group">
                    <span className="panel-eyebrow">Biblioteca</span>
                    <h1 className="panel-title panel-title--hero">Control center de carteleria</h1>
                    <p className="panel-description">
                        Arrastra archivos sobre todo el panel para sumarlos a la playlist operativa.
                    </p>
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
                    <span>Formato recomendado para TV: {RECOMMENDED_SIGNAGE_VIDEO_PROFILE}.</span>
                </div>
            </div>

            {selectedFiles.length > 0 ? (
                <div className="library-notice">
                    <p className="library-notice__title">
                        {isBusy
                            ? `Subiendo ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}...`
                            : `Ultima carga: ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}`}
                    </p>

                    <ul className="library-notice__list">
                        {selectedFiles.map((fileName) => (
                            <li key={fileName}>{fileName}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

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
        </section>
    )
}