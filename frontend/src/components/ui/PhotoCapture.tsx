'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Upload,
  X,
  RotateCcw,
  Check,
  Image as ImageIcon,
  AlertCircle,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import { Button } from './Button'

interface PhotoCaptureProps {
  onCapture: (photos: string[]) => void
  maxPhotos?: number
  existingPhotos?: string[]
  label?: string
  hint?: string
}

export function PhotoCapture({
  onCapture,
  maxPhotos = 5,
  existingPhotos = [],
  label = 'Add Photos',
  hint = 'Capture or upload photos of symptoms, rashes, or injuries',
}: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos)
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setStream(mediaStream)
      setShowCamera(true)
      
      // Wait for video ref to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      }, 100)
    } catch (err) {
      setError('Unable to access camera. Please check permissions.')
      console.error('Camera error:', err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setShowCamera(false)
    setCapturedImage(null)
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        setCapturedImage(imageData)
      }
    }
  }, [])

  const confirmCapture = useCallback(() => {
    if (capturedImage) {
      const newPhotos = [...photos, capturedImage]
      setPhotos(newPhotos)
      onCapture(newPhotos)
      setCapturedImage(null)
      
      if (newPhotos.length >= maxPhotos) {
        stopCamera()
      }
    }
  }, [capturedImage, photos, onCapture, maxPhotos, stopCamera])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (photos.length >= maxPhotos) return
      
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageData = event.target?.result as string
        const newPhotos = [...photos, imageData]
        setPhotos(newPhotos)
        onCapture(newPhotos)
      }
      reader.readAsDataURL(file)
    })
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [photos, maxPhotos, onCapture])

  const removePhoto = useCallback((index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    onCapture(newPhotos)
  }, [photos, onCapture])

  const canAddMore = photos.length < maxPhotos

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          {label}
        </label>
        <p className="text-xs text-surface-500">{hint}</p>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-square rounded-xl overflow-hidden group"
            >
              <img
                src={photo}
                alt={`Symptom photo ${index + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setSelectedPhoto(photo)}
                  className="p-2 bg-white/90 rounded-full text-surface-700 hover:bg-white"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removePhoto(index)}
                  className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">
                {index + 1}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Photo Buttons */}
      {canAddMore && (
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={startCamera}
            icon={<Camera className="w-4 h-4" />}
            className="flex-1"
          >
            Take Photo
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload className="w-4 h-4" />}
            className="flex-1"
          >
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Photo Count */}
      <div className="text-xs text-surface-500 text-center">
        {photos.length} of {maxPhotos} photos added
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
          >
            {/* Camera View */}
            <div className="flex-1 relative">
              {!capturedImage ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Close Button */}
              <button
                onClick={stopCamera}
                className="absolute top-4 right-4 p-3 bg-black/50 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Capture Guide Overlay */}
              {!capturedImage && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-8 border-2 border-white/30 rounded-2xl" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center">
                    <p className="text-sm opacity-75">Center the affected area</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="bg-black p-6">
              {!capturedImage ? (
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={stopCamera}
                    className="p-4 rounded-full bg-white/10 text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center"
                  >
                    <div className="w-16 h-16 rounded-full border-4 border-black/20" />
                  </button>
                  <div className="w-14" /> {/* Spacer for alignment */}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={retakePhoto}
                    className="p-4 rounded-full bg-white/10 text-white flex flex-col items-center gap-1"
                  >
                    <RotateCcw className="w-6 h-6" />
                    <span className="text-xs">Retake</span>
                  </button>
                  <button
                    onClick={confirmCapture}
                    className="p-4 rounded-full bg-emerald-500 text-white flex flex-col items-center gap-1"
                  >
                    <Check className="w-8 h-8" />
                    <span className="text-xs">Use Photo</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hidden Canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Preview Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhoto}
              alt="Full size preview"
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PhotoCapture
