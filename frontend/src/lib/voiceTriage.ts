/**
 * Voice + Vision Triage — Client-side Gemini Live API session manager.
 *
 * Captures microphone audio and optional camera video, streams both
 * to the Gemini Live API, receives audio + text responses, and plays
 * them back.
 *
 * Uses the @google/genai SDK's live.connect() with sendRealtimeInput()
 * for both audio PCM chunks and JPEG video frames.
 */

import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai'

const VOICE_SYSTEM_PROMPT = `You are the EPCID Voice Triage Assistant — a calm, empathetic pediatric nurse helping a worried parent over a voice call.

You can HEAR the parent and, when they enable their camera, you can also SEE what they show you (rashes, injuries, skin conditions, thermometer readings, etc.).

RULES:
1. Keep answers SHORT (2-3 sentences max). Parents are stressed — be clear and concise.
2. Ask ONE follow-up question at a time to gather symptoms.
3. If any RED FLAG symptom is mentioned or seen (difficulty breathing, unresponsive, seizure, blue lips, stiff neck with fever, petechiae, spreading purple rash) — IMMEDIATELY say "Please seek medical care right now" and explain why.
4. When the parent shows you something on camera, describe what you observe and incorporate it into your assessment.
5. After gathering symptoms, provide a clear urgency level: Low / Moderate / High / Critical.
6. Never diagnose. Say "This could indicate…" not "Your child has…".
7. Speak naturally as if on a phone call. No markdown, no bullet points.
8. Always end your assessment with "Would you like me to help with anything else?"

Start by introducing yourself briefly and asking what's going on with their child.`

export type VoiceTriageStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'ai_speaking'
  | 'processing'
  | 'error'
  | 'ended'

export interface VoiceTriageCallbacks {
  onStatusChange: (status: VoiceTriageStatus) => void
  onTranscriptUpdate: (role: 'user' | 'assistant', text: string) => void
  onAudioLevel: (level: number) => void
  onError: (message: string) => void
  onCameraChange?: (active: boolean) => void
}

const CAMERA_FRAME_INTERVAL_MS = 1000

export class VoiceTriageSession {
  private session: Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>> | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | ScriptProcessorNode | null = null
  private playbackQueue: ArrayBuffer[] = []
  private isPlaying = false
  private callbacks: VoiceTriageCallbacks
  private status: VoiceTriageStatus = 'idle'

  private cameraStream: MediaStream | null = null
  private cameraVideo: HTMLVideoElement | null = null
  private cameraCanvas: HTMLCanvasElement | null = null
  private cameraIntervalId: ReturnType<typeof setInterval> | null = null
  private _cameraActive = false

  constructor(callbacks: VoiceTriageCallbacks) {
    this.callbacks = callbacks
  }

  get cameraActive(): boolean {
    return this._cameraActive
  }

  private setStatus(s: VoiceTriageStatus) {
    this.status = s
    this.callbacks.onStatusChange(s)
  }

  async start(apiKey: string, childContext?: string) {
    try {
      this.setStatus('connecting')

      const ai = new GoogleGenAI({ apiKey })

      const systemInstruction = childContext
        ? `${VOICE_SYSTEM_PROMPT}\n\nCONTEXT: ${childContext}`
        : VOICE_SYSTEM_PROMPT

      this.session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            this.setStatus('listening')
          },
          onmessage: (msg: LiveServerMessage) => {
            this.handleServerMessage(msg)
          },
          onerror: (e: ErrorEvent) => {
            console.error('[VoiceTriage] WebSocket error:', e)
            this.callbacks.onError('Voice connection error. Please try again.')
            this.setStatus('error')
          },
          onclose: () => {
            if (this.status !== 'error' && this.status !== 'ended') {
              this.setStatus('ended')
            }
          },
        },
      })

      await this.startMicrophone()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start voice session'
      console.error('[VoiceTriage] start error:', err)
      this.callbacks.onError(message)
      this.setStatus('error')
    }
  }

  // ── Camera (Vision) ──

  async enableCamera(): Promise<HTMLVideoElement | null> {
    if (this._cameraActive) return this.cameraVideo

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      })

      this.cameraVideo = document.createElement('video')
      this.cameraVideo.srcObject = this.cameraStream
      this.cameraVideo.setAttribute('playsinline', 'true')
      this.cameraVideo.muted = true
      await this.cameraVideo.play()

      this.cameraCanvas = document.createElement('canvas')
      this.cameraCanvas.width = 640
      this.cameraCanvas.height = 480

      this._cameraActive = true
      this.callbacks.onCameraChange?.(true)

      this.cameraIntervalId = setInterval(() => {
        this.captureAndSendFrame()
      }, CAMERA_FRAME_INTERVAL_MS)

      return this.cameraVideo
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera access denied'
      console.error('[VoiceTriage] camera error:', err)
      this.callbacks.onError(message)
      return null
    }
  }

  disableCamera() {
    if (this.cameraIntervalId) {
      clearInterval(this.cameraIntervalId)
      this.cameraIntervalId = null
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop())
      this.cameraStream = null
    }
    if (this.cameraVideo) {
      this.cameraVideo.pause()
      this.cameraVideo.srcObject = null
      this.cameraVideo = null
    }
    this.cameraCanvas = null
    this._cameraActive = false
    this.callbacks.onCameraChange?.(false)
  }

  private captureAndSendFrame() {
    if (!this.session || !this.cameraVideo || !this.cameraCanvas) return
    if (this.cameraVideo.readyState < 2) return

    const ctx = this.cameraCanvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(this.cameraVideo, 0, 0, 640, 480)

    const dataUrl = this.cameraCanvas.toDataURL('image/jpeg', 0.6)
    const base64 = dataUrl.split(',')[1]
    if (!base64) return

    try {
      this.session.sendRealtimeInput({
        video: {
          data: base64,
          mimeType: 'image/jpeg',
        },
      })
    } catch {
      // Silently drop frame if the session is closing
    }
  }

  // ── Microphone (Audio) ──

  private async startMicrophone() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)

    // ScriptProcessorNode is deprecated but widely supported;
    // AudioWorklet requires a separate file which complicates bundling.
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.workletNode = processor

    processor.onaudioprocess = (e) => {
      if (this.status !== 'listening' && this.status !== 'ai_speaking') return
      const float32 = e.inputBuffer.getChannelData(0)
      this.sendAudioChunk(float32)

      let sum = 0
      for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i]
      this.callbacks.onAudioLevel(Math.sqrt(sum / float32.length))
    }

    source.connect(processor)
    processor.connect(this.audioContext.destination)
  }

  private sendAudioChunk(float32: Float32Array) {
    if (!this.session) return

    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    const base64 = this.arrayBufferToBase64(int16.buffer)
    this.session.sendRealtimeInput({
      audio: {
        data: base64,
        mimeType: 'audio/pcm;rate=16000',
      },
    })
  }

  // ── Server messages ──

  private handleServerMessage(msg: LiveServerMessage) {
    const sc = msg.serverContent
    if (!sc) return

    if (sc.inputTranscription?.text) {
      this.callbacks.onTranscriptUpdate('user', sc.inputTranscription.text)
    }
    if (sc.outputTranscription?.text) {
      this.callbacks.onTranscriptUpdate('assistant', sc.outputTranscription.text)
    }

    const parts = sc.modelTurn?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.setStatus('ai_speaking')
          const audioBytes = this.base64ToArrayBuffer(part.inlineData.data)
          this.playbackQueue.push(audioBytes)
          this.drainPlaybackQueue()
        }
        if (part.text) {
          this.callbacks.onTranscriptUpdate('assistant', part.text)
        }
      }
    }

    if (sc.turnComplete) {
      this.setStatus('listening')
    }
  }

  // ── Audio playback ──

  private async drainPlaybackQueue() {
    if (this.isPlaying || this.playbackQueue.length === 0) return
    this.isPlaying = true

    while (this.playbackQueue.length > 0) {
      const raw = this.playbackQueue.shift()!
      await this.playPcm24k(raw)
    }

    this.isPlaying = false
  }

  private playPcm24k(raw: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      const playCtx = new AudioContext({ sampleRate: 24000 })
      const int16 = new Int16Array(raw)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000
      }

      const buffer = playCtx.createBuffer(1, float32.length, 24000)
      buffer.getChannelData(0).set(float32)

      const src = playCtx.createBufferSource()
      src.buffer = buffer
      src.connect(playCtx.destination)
      src.onended = () => {
        playCtx.close()
        resolve()
      }
      src.start()
    })
  }

  // ── Utilities ──

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  // ── Lifecycle ──

  stop() {
    this.disableCamera()
    this.session?.close()
    this.session = null

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.playbackQueue = []
    this.isPlaying = false
    this.setStatus('ended')
  }

  getStatus(): VoiceTriageStatus {
    return this.status
  }
}
