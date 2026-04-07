import { Settings01Icon, ComputerVideoIcon } from '@hugeicons-pro/core-solid-standard'
import { Link } from 'react-router-dom'
import { ORIENTATION_OPTIONS } from '../lib/media'
import type { MediaItem, Orientation } from '../types/media'
import { Icon } from './Icon'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'

interface InspectorPanelProps {
    selectedItem: MediaItem | null
    orientation: Orientation
    imageDurationSeconds: number
    onOrientationChange: (orientation: Orientation) => void
    onChangeImageDuration: (seconds: number) => void
    onChangeDurationOverride: (id: string, seconds: number | null) => void
}

export function InspectorPanel({
    selectedItem,
    orientation,
    imageDurationSeconds,
    onOrientationChange,
    onChangeImageDuration,
    onChangeDurationOverride,
}: InspectorPanelProps) {
    return (
        <aside className="panel inspector-panel">
            <div className="panel-header inspector-panel__header">
                <div className="panel-title-group">
                    <span className="panel-eyebrow">Configuracion</span>
                    <h2 className="panel-title">Inspector de emision</h2>
                </div>


            </div>
            <Link className="panel-link" target="_blank" to="/player">
                <Icon icon={ComputerVideoIcon} size={18} />
                <span>Abrir player</span>
            </Link>
            <section className="inspector-group">
                <div className="inspector-group__label">
                    <Icon icon={Settings01Icon} size={16} />
                    <span>Orientacion</span>
                </div>

                <Select onValueChange={(value) => onOrientationChange(value as Orientation)} value={orientation}>
                    <SelectTrigger aria-label="Orientacion global">
                        <SelectValue placeholder="Selecciona una orientacion" />
                    </SelectTrigger>

                    <SelectContent>
                        {ORIENTATION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </section>

            <section className="inspector-group">
                <div className="profile-summary-card">
                    <div className="profile-summary-card__header">
                        <strong>Video nativo</strong>
                        <span className="profile-badge profile-badge--native">Fijo</span>
                    </div>


                </div>
            </section>

            <section className="inspector-group">
                <div className="inspector-field">
                    <label className="inspector-field__label" htmlFor="image-duration-default">
                        Duracion por defecto para imagenes
                    </label>

                    <div className="number-field">
                        <input
                            className="number-field__input"
                            id="image-duration-default"
                            max={300}
                            min={3}
                            onChange={(event) => {
                                const nextValue = Number(event.target.value)

                                if (Number.isFinite(nextValue)) {
                                    onChangeImageDuration(nextValue)
                                }
                            }}
                            step={1}
                            type="number"
                            value={imageDurationSeconds}
                        />
                        <span className="number-field__suffix">seg</span>
                    </div>
                </div>

                {selectedItem?.type === 'image' ? (
                    <div className="inspector-field">
                        <label className="inspector-field__label" htmlFor="image-duration-override">
                            Override del item seleccionado
                        </label>

                        <div className="number-field">
                            <input
                                className="number-field__input"
                                id="image-duration-override"
                                max={300}
                                min={3}
                                onChange={(event) => {
                                    const value = event.target.value

                                    onChangeDurationOverride(selectedItem.id, value === '' ? null : Number(value))
                                }}
                                placeholder="Usar valor global"
                                step={1}
                                type="number"
                                value={selectedItem.durationOverrideSeconds ?? ''}
                            />
                            <span className="number-field__suffix">seg</span>
                        </div>
                    </div>
                ) : null}
            </section>
        </aside>
    )
}
