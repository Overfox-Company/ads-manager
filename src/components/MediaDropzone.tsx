import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FolderUploadIcon } from '@hugeicons-pro/core-solid-standard'
import { RECOMMENDED_SIGNAGE_VIDEO_PROFILE } from '../lib/mediaPolicy'
import { Icon } from './Icon'

interface MediaDropzoneProps {
    itemCount: number
    isBusy: boolean
    selectedFiles: string[]
    uploadErrorMessage: string | null
    uploadWarningMessages: string[]
    onFilesAccepted: (files: File[]) => Promise<void> | void
}

export function MediaDropzone({
    itemCount,
    isBusy,
    selectedFiles,
    uploadErrorMessage,
    uploadWarningMessages,
    onFilesAccepted,
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
        <div>
            <div
                {...getRootProps()}
                className={`dropzone${isDragActive ? ' dropzone--active' : ''}`}
            >
                <input {...getInputProps()} />

                <div className="dropzone__icon" aria-hidden="true">
                    <Icon icon={FolderUploadIcon} size={24} />
                </div>

                <div className="dropzone__copy">
                    <strong>Arrastra imagenes y videos aqui</strong>
                    <span>o selecciona archivos desde este equipo para persistirlos en el backend.</span>
                    <span className="dropzone__meta">
                        {itemCount === 0
                            ? 'Aun no hay contenidos en la playlist.'
                            : `${itemCount} elementos cargados y persistidos localmente.`}
                    </span>
                    <span className="dropzone__meta">
                        Perfil recomendado para TV: {RECOMMENDED_SIGNAGE_VIDEO_PROFILE}.
                    </span>
                </div>

                <button className="dropzone__button" disabled={isBusy} onClick={open} type="button">
                    {isBusy ? 'Cargando...' : 'Seleccionar archivos'}
                </button>
            </div>

            {selectedFiles.length > 0 ? (
                <div className="dropzone__selection-summary">
                    <p className="dropzone__selection-title">
                        {isBusy
                            ? `Subiendo ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}...`
                            : `Ultima seleccion: ${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'}`}
                    </p>

                    <ul className="dropzone__selection-list">
                        {selectedFiles.map((fileName) => (
                            <li key={fileName} className="dropzone__selection-item">
                                {fileName}
                            </li>
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
        </div>
    )
}