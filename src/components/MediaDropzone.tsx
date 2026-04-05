import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FolderUploadIcon } from '@hugeicons-pro/core-solid-standard'
import { Icon } from './Icon'

interface MediaDropzoneProps {
    itemCount: number
    isBusy: boolean
    onFilesAccepted: (files: File[]) => Promise<void> | void
}

export function MediaDropzone({ itemCount, isBusy, onFilesAccepted }: MediaDropzoneProps) {
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
                    <span>o selecciona archivos desde este equipo para guardarlos en el navegador.</span>
                    <span className="dropzone__meta">
                        {itemCount === 0
                            ? 'Aun no hay contenidos en la playlist.'
                            : `${itemCount} elementos cargados y persistidos localmente.`}
                    </span>
                </div>

                <button className="dropzone__button" disabled={isBusy} onClick={open} type="button">
                    {isBusy ? 'Cargando...' : 'Seleccionar archivos'}
                </button>
            </div>

            {errorMessage ? <p className="dropzone__error">{errorMessage}</p> : null}
        </div>
    )
}