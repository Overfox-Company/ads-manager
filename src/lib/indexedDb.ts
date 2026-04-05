const DATABASE_NAME = 'ads-manager-media-db'
const DATABASE_VERSION = 1
const STORE_NAME = 'media-files'

interface StoredMediaRecord {
    id: string
    name: string
    mimeType: string
    size: number
    createdAt: number
    blob: Blob
}

function openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

        request.onupgradeneeded = () => {
            const database = request.result

            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
    })
}

async function getStore(mode: IDBTransactionMode) {
    const database = await openDatabase()
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)

    return { database, transaction, store }
}

export async function saveMediaBlob(input: {
    id: string
    name: string
    mimeType: string
    size: number
    createdAt: number
    blob: Blob
}) {
    const { database, transaction, store } = await getStore('readwrite')

    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
            database.close()
            resolve()
        }

        transaction.onerror = () => {
            database.close()
            reject(transaction.error ?? new Error('No se pudo guardar el archivo'))
        }

        const record: StoredMediaRecord = {
            id: input.id,
            name: input.name,
            mimeType: input.mimeType,
            size: input.size,
            createdAt: input.createdAt,
            blob: input.blob,
        }

        store.put(record)
    })
}

export async function getMediaBlob(id: string) {
    const { database, transaction, store } = await getStore('readonly')

    return new Promise<Blob | null>((resolve, reject) => {
        const request = store.get(id)

        request.onsuccess = () => {
            const record = request.result as StoredMediaRecord | undefined
            resolve(record?.blob ?? null)
        }

        request.onerror = () => {
            reject(request.error ?? new Error('No se pudo leer el blob'))
        }

        transaction.oncomplete = () => {
            database.close()
        }

        transaction.onerror = () => {
            database.close()
        }
    })
}

export async function deleteMediaBlob(id: string) {
    const { database, transaction, store } = await getStore('readwrite')

    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
            database.close()
            resolve()
        }

        transaction.onerror = () => {
            database.close()
            reject(transaction.error ?? new Error('No se pudo eliminar el blob'))
        }

        store.delete(id)
    })
}