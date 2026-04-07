import { access, chmod, mkdtemp, rm, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import {
    getPlaybackProfileDefinition,
    inferSupportedProfiles,
} from '../src/lib/playbackProfiles'
import type {
    AudioCodec,
    MediaItem,
    MediaVariant,
    PlaybackProfileId,
    UploadMediaDescriptor,
    VideoCodec,
    VideoContainer,
} from '../src/types/media'
import { createNativeStorageId, createVariantStorageId } from './mediaStorage'

interface PreparedUploadFile {
    storageId: string
    filePath: string
}

interface PreparedAutomaticVideoAsset {
    item: MediaItem
    files: PreparedUploadFile[]
    cleanupPaths: string[]
}

interface ProbedVideoMetadata {
    duration: number | null
    width: number | null
    height: number | null
    fps: number | null
    bitrateKbps: number | null
    videoCodec: VideoCodec
    audioCodec: AudioCodec
    audioChannels: number | null
    container: VideoContainer
}

interface VariantTarget {
    profile: PlaybackProfileId
    videoCodec: Extract<VideoCodec, 'h264' | 'hevc'>
    widthCap: number
    fpsCap: number
    videoBitrateKbps: number
    audioBitrateKbps: number
    cpuPreset: string
}

interface FfmpegCapabilities {
    encoders: Set<string>
}

interface VideoEncoderPlan {
    encoder: string
    args: string[]
}

const ffmpegStaticPath = ffmpegInstaller.path
const ffprobeStaticPath = ffprobeInstaller.path
let ffmpegExecutablePromise: Promise<string> | null = null
let ffprobeExecutablePromise: Promise<string> | null = null
let ffmpegCapabilitiesPromise: Promise<FfmpegCapabilities> | null = null

async function resolveExecutablePath(candidate: string | null | undefined, fallback: string) {
    if (candidate && candidate.length > 0) {
        try {
            await access(candidate, constants.X_OK)
            return candidate
        } catch {
            try {
                await chmod(candidate, 0o755)
                await access(candidate, constants.X_OK)
                return candidate
            } catch {
                // Fallback to the system executable when the packaged binary is missing or unusable.
            }
        }
    }

    return fallback
}

function getFfmpegExecutable() {
    ffmpegExecutablePromise ??= resolveExecutablePath(process.env.FFMPEG_PATH ?? ffmpegStaticPath, 'ffmpeg')

    return ffmpegExecutablePromise
}

function getFfprobeExecutable() {
    ffprobeExecutablePromise ??= resolveExecutablePath(process.env.FFPROBE_PATH ?? ffprobeStaticPath, 'ffprobe')

    return ffprobeExecutablePromise
}

async function getFfmpegCapabilities() {
    ffmpegCapabilitiesPromise ??= (async () => {
        const ffmpegExecutable = await getFfmpegExecutable()
        const { stdout } = await runCommand(ffmpegExecutable, ['-hide_banner', '-encoders'])
        const encoders = new Set<string>()

        for (const line of stdout.split('\n')) {
            const trimmed = line.trim()

            if (!trimmed || !trimmed.startsWith('V')) {
                continue
            }

            const parts = trimmed.split(/\s+/)
            const encoder = parts[1]

            if (encoder) {
                encoders.add(encoder)
            }
        }

        return { encoders }
    })()

    return ffmpegCapabilitiesPromise
}

function parseFrameRate(value: string | undefined) {
    if (!value || value === '0/0') {
        return null
    }

    const [numeratorRaw, denominatorRaw] = value.split('/')
    const numerator = Number(numeratorRaw)
    const denominator = Number(denominatorRaw)

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        return null
    }

    const parsed = numerator / denominator

    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) / 1000 : null
}

function normalizeVideoCodec(input: string | undefined): VideoCodec {
    if (input === 'h264') {
        return 'h264'
    }

    if (input === 'hevc' || input === 'h265') {
        return 'hevc'
    }

    if (input === 'av1') {
        return 'av1'
    }

    return 'unknown'
}

function normalizeAudioCodec(input: string | undefined): AudioCodec {
    if (input === 'aac') {
        return 'aac'
    }

    if (input === 'opus') {
        return 'opus'
    }

    return 'unknown'
}

function normalizeContainer(input: string | undefined): VideoContainer {
    if (!input) {
        return 'unknown'
    }

    if (input.includes('mp4') || input.includes('mov')) {
        return 'mp4'
    }

    if (input.includes('webm')) {
        return 'webm'
    }

    return 'unknown'
}

function roundBitrateKbps(value: string | number | undefined) {
    const parsed = typeof value === 'number' ? value : Number(value)

    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed / 1000) : null
}

function toEvenDimension(value: number) {
    const rounded = Math.max(2, Math.round(value))

    return rounded % 2 === 0 ? rounded : rounded - 1
}

function buildScaledDimensions(width: number | null, height: number | null, widthCap: number) {
    if (!width || !height) {
        return { width: widthCap, height: null }
    }

    const ratio = Math.min(1, widthCap / width)

    return {
        width: toEvenDimension(width * ratio),
        height: toEvenDimension(height * ratio),
    }
}

function resolveOutputFrameRate(sourceFps: number | null, fpsCap: number) {
    if (!sourceFps || sourceFps <= 0) {
        return null
    }

    return sourceFps > fpsCap ? fpsCap : sourceFps
}

function clampBitrateKbps(candidateKbps: number, minimumKbps: number, ceilingKbps: number | null) {
    if (!Number.isFinite(candidateKbps) || candidateKbps <= 0) {
        if (ceilingKbps && Number.isFinite(ceilingKbps) && ceilingKbps > 0) {
            return Math.round(Math.min(minimumKbps, ceilingKbps))
        }

        return minimumKbps
    }

    if (!ceilingKbps || !Number.isFinite(ceilingKbps) || ceilingKbps <= 0) {
        return Math.max(minimumKbps, Math.round(candidateKbps))
    }

    const effectiveMinimum = Math.min(minimumKbps, Math.round(ceilingKbps))

    return Math.max(effectiveMinimum, Math.min(Math.round(candidateKbps), Math.round(ceilingKbps)))
}

function deriveVideoBitrateLadder(source: ProbedVideoMetadata) {
    const sourceBitrate = source.bitrateKbps ?? null

    return {
        compatibility: clampBitrateKbps(sourceBitrate ? sourceBitrate * 0.55 : 1800, 450, sourceBitrate ? sourceBitrate * 0.8 : null),
        balanced: clampBitrateKbps(sourceBitrate ? sourceBitrate * 0.9 : 3200, 900, sourceBitrate ? sourceBitrate * 1.05 : null),
        modernEfficiency: clampBitrateKbps(sourceBitrate ? sourceBitrate * 0.7 : 2800, 700, sourceBitrate ? sourceBitrate * 0.9 : null),
        modernQuality: clampBitrateKbps(sourceBitrate ? sourceBitrate * 0.95 : 6000, 1200, sourceBitrate ? sourceBitrate * 1.05 : null),
    }
}

function buildVariantTargets(source: ProbedVideoMetadata): VariantTarget[] {
    const bitrateLadder = deriveVideoBitrateLadder(source)
    return [
        {
            profile: 'compatibility',
            videoCodec: 'h264',
            widthCap: 1280,
            fpsCap: 30,
            videoBitrateKbps: bitrateLadder.compatibility,
            audioBitrateKbps: 128,
            cpuPreset: 'veryfast',
        },
        {
            profile: 'balanced',
            videoCodec: 'h264',
            widthCap: 1920,
            fpsCap: 30,
            videoBitrateKbps: bitrateLadder.balanced,
            audioBitrateKbps: 160,
            cpuPreset: 'faster',
        },
    ]
}

function buildTranscodedProbe(source: ProbedVideoMetadata, target: VariantTarget): ProbedVideoMetadata {
    const dimensions = buildScaledDimensions(source.width, source.height, target.widthCap)

    return {
        duration: source.duration,
        width: dimensions.height ? dimensions.width : null,
        height: dimensions.height,
        fps: resolveOutputFrameRate(source.fps, target.fpsCap),
        bitrateKbps: target.videoBitrateKbps + target.audioBitrateKbps,
        videoCodec: target.videoCodec,
        audioCodec: 'aac',
        audioChannels: 2,
        container: 'mp4',
    }
}

function canReuseSourceForTarget(source: ProbedVideoMetadata, target: VariantTarget) {
    if (source.container !== 'mp4' || source.videoCodec !== target.videoCodec) {
        return false
    }

    if (source.width && source.width > target.widthCap) {
        return false
    }

    if (source.fps && source.fps > target.fpsCap) {
        return false
    }

    if (source.audioCodec !== 'aac' && source.audioCodec !== 'unknown') {
        return false
    }

    if (source.audioChannels && source.audioChannels > 2) {
        return false
    }

    if (source.bitrateKbps && source.bitrateKbps > Math.round(target.videoBitrateKbps * 1.15)) {
        return false
    }

    return true
}

function createSourceVariantRecord(assetId: string, storageId: string, descriptor: UploadMediaDescriptor, probe: ProbedVideoMetadata): MediaVariant {
    return {
        id: `${assetId}:${storageId}`,
        storageId,
        label: 'Nativa',
        profile: 'native',
        supportedProfiles: ['native'],
        container: probe.container,
        videoCodec: probe.videoCodec,
        audioCodec: probe.audioCodec,
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        bitrateKbps: probe.bitrateKbps ?? descriptor.bitrateKbps,
        mimeType: descriptor.mimeType,
        isMaster: true,
    }
}

async function resolveVideoEncoderPlan(target: VariantTarget): Promise<VideoEncoderPlan> {
    const capabilities = await getFfmpegCapabilities()

    if (target.videoCodec === 'h264' && capabilities.encoders.has('h264_videotoolbox')) {
        return {
            encoder: 'h264_videotoolbox',
            args: ['-profile:v', 'main', '-allow_sw', '1'],
        }
    }

    if (target.videoCodec === 'hevc' && capabilities.encoders.has('hevc_videotoolbox')) {
        return {
            encoder: 'hevc_videotoolbox',
            args: ['-tag:v', 'hvc1', '-allow_sw', '1'],
        }
    }

    return {
        encoder: target.videoCodec === 'hevc' ? 'libx265' : 'libx264',
        args: [
            '-preset',
            target.cpuPreset,
            ...(target.videoCodec === 'hevc' ? ['-tag:v', 'hvc1'] : []),
        ],
    }
}

function runCommand(command: string, args: string[]) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        child.on('error', (error) => {
            reject(error)
        })

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr })
                return
            }

            reject(new Error(stderr || `El comando ${command} termino con codigo ${code ?? 'desconocido'}`))
        })
    })
}

async function probeVideo(filePath: string): Promise<ProbedVideoMetadata> {
    const ffprobeExecutable = await getFfprobeExecutable()
    const { stdout } = await runCommand(ffprobeExecutable, [
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-print_format',
        'json',
        filePath,
    ])
    const payload = JSON.parse(stdout) as {
        streams?: Array<Record<string, string | number | undefined>>
        format?: Record<string, string | number | undefined>
    }
    const videoStream = payload.streams?.find((stream) => stream.codec_type === 'video')
    const audioStream = payload.streams?.find((stream) => stream.codec_type === 'audio')

    return {
        duration: Number(payload.format?.duration ?? videoStream?.duration) || null,
        width: Number(videoStream?.width) || null,
        height: Number(videoStream?.height) || null,
        fps: parseFrameRate(String(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate ?? '')),
        bitrateKbps: roundBitrateKbps(videoStream?.bit_rate ?? payload.format?.bit_rate),
        videoCodec: normalizeVideoCodec(typeof videoStream?.codec_name === 'string' ? videoStream.codec_name : undefined),
        audioCodec: normalizeAudioCodec(typeof audioStream?.codec_name === 'string' ? audioStream.codec_name : undefined),
        audioChannels: Number(audioStream?.channels) || null,
        container: normalizeContainer(typeof payload.format?.format_name === 'string' ? payload.format.format_name : undefined),
    }
}

async function transcodeVariant(sourceFilePath: string, outputFilePath: string, source: ProbedVideoMetadata, target: VariantTarget) {
    const ffmpegExecutable = await getFfmpegExecutable()
    const encoderPlan = await resolveVideoEncoderPlan(target)
    const dimensions = buildScaledDimensions(source.width, source.height, target.widthCap)
    const scaleFilter = dimensions.height
        ? `scale=${dimensions.width}:${dimensions.height},setsar=1`
        : `scale='trunc(min(${target.widthCap},iw)/2)*2':'trunc(ow/a/2)*2',setsar=1`
    const filters = [scaleFilter]
    const shouldCopyAudio = source.audioCodec === 'aac' && (!source.audioChannels || source.audioChannels <= 2)

    if (source.fps && source.fps > target.fpsCap) {
        filters.push(`fps=${target.fpsCap}`)
    }

    const audioArgs = shouldCopyAudio
        ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-ac', '2', '-b:a', `${target.audioBitrateKbps}k`]

    await runCommand(ffmpegExecutable, [
        '-y',
        '-i',
        sourceFilePath,
        '-vf',
        filters.join(','),
        '-c:v',
        encoderPlan.encoder,
        ...encoderPlan.args,
        '-pix_fmt',
        'yuv420p',
        '-b:v',
        `${target.videoBitrateKbps}k`,
        '-maxrate',
        `${target.videoBitrateKbps}k`,
        '-bufsize',
        `${target.videoBitrateKbps * 2}k`,
        ...audioArgs,
        '-movflags',
        '+faststart',
        outputFilePath,
    ])
}

function createVariantRecord(assetId: string, storageId: string, profile: PlaybackProfileId, probe: ProbedVideoMetadata): MediaVariant {
    const supportedProfiles = inferSupportedProfiles(profile, probe.videoCodec, probe.width, probe.fps)

    return {
        id: `${assetId}:${storageId}`,
        storageId,
        label: getPlaybackProfileDefinition(profile).label,
        profile,
        supportedProfiles,
        container: probe.container,
        videoCodec: probe.videoCodec,
        audioCodec: probe.audioCodec,
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        bitrateKbps: probe.bitrateKbps,
        mimeType: 'video/mp4',
        isMaster: false,
    }
}

export async function prepareAutomaticVideoAsset(input: {
    descriptor: UploadMediaDescriptor
    sourceFilePath: string
    sourceExtension: string
}): Promise<PreparedAutomaticVideoAsset> {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'ads-manager-variants-'))
    try {
        const sourceProbe = await probeVideo(input.sourceFilePath)
        const variantTargets = buildVariantTargets(sourceProbe)
        const nativeStorageId = createNativeStorageId(input.descriptor.id, input.sourceExtension)
        const nativeVariant = createSourceVariantRecord(input.descriptor.id, nativeStorageId, input.descriptor, sourceProbe)
        const files: PreparedUploadFile[] = [
            {
                storageId: nativeStorageId,
                filePath: input.sourceFilePath,
            },
        ]
        const variants: MediaVariant[] = [nativeVariant]

        for (const target of variantTargets) {
            if (canReuseSourceForTarget(sourceProbe, target)) {
                continue
            }

            const storageId = createVariantStorageId(input.descriptor.id, target.profile)
            const outputFilePath = path.join(tempDirectory, `${target.profile}.mp4`)

            await transcodeVariant(input.sourceFilePath, outputFilePath, sourceProbe, target)
            const probe = buildTranscodedProbe(sourceProbe, target)

            files.push({ storageId, filePath: outputFilePath })
            variants.push(createVariantRecord(input.descriptor.id, storageId, target.profile, probe))
        }

        const totalSize = (await Promise.all(files.map(async (file) => stat(file.filePath)))).reduce((sum, fileStat) => sum + fileStat.size, 0)

        return {
            item: {
                id: input.descriptor.id,
                storageId: nativeStorageId,
                name: input.descriptor.name,
                type: 'video',
                mimeType: input.descriptor.mimeType,
                size: totalSize,
                createdAt: input.descriptor.createdAt,
                durationOverrideSeconds: null,
                naturalDurationSeconds: sourceProbe.duration,
                variants,
            },
            files,
            cleanupPaths: [tempDirectory],
        }
    } catch (error) {
        await rm(tempDirectory, { recursive: true, force: true })
        throw error
    }
}

export async function cleanupPreparedPaths(paths: string[]) {
    await Promise.all(paths.map(async (targetPath) => {
        await rm(targetPath, { recursive: true, force: true })
    }))
}