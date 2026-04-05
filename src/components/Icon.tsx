import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'

interface IconProps {
    icon: IconSvgElement
    size?: number
    className?: string
}

export function Icon({ icon, size = 18, className }: IconProps) {
    return <HugeiconsIcon className={className} icon={icon} size={size} />
}