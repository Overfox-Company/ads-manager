function getDevServerOrigin() {
    const url = new URL(window.location.origin)

    url.port = '8787'
    return url.origin
}

export function getServerHttpOrigin() {
    return import.meta.env.DEV ? getDevServerOrigin() : window.location.origin
}

export function getServerHttpUrl(pathname: string) {
    return new URL(pathname, `${getServerHttpOrigin()}/`).toString()
}

export function getServerWebSocketUrl(pathname: string) {
    const url = new URL(getServerHttpUrl(pathname))

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
}