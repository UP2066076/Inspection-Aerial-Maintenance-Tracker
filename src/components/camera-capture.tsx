'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera as CameraIcon, CameraOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const CAPTURE_WIDTH = 212;
const CAPTURE_HEIGHT = 283;
const ASPECT_RATIO = CAPTURE_WIDTH / CAPTURE_HEIGHT;

type CameraCaptureProps = {
  onCapture: (imageDataUrl: string) => void;
  disabled?: boolean;
};

export function CameraCapture({ onCapture, disabled = false }: CameraCaptureProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('Camera API not supported in this browser.');
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };

    getCameraPermission();

    return () => {
      // Cleanup: stop video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [toast]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const videoAspectRatio = videoWidth / videoHeight;

    let sx, sy, sWidth, sHeight;

    if (videoAspectRatio > ASPECT_RATIO) {
      sHeight = videoHeight;
      sWidth = sHeight * ASPECT_RATIO;
      sx = (videoWidth - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = videoWidth;
      sHeight = sWidth / ASPECT_RATIO;
      sx = 0;
      sy = (videoHeight - sHeight) / 2;
    }

    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);

    const imageDataUrl = canvas.toDataURL('image/jpeg');
    onCapture(imageDataUrl);

    toast({
      title: 'Image Captured!',
      description: 'The photo has been added to the image slots.',
    });
  }, [onCapture, toast]);

  return (
    <div className="relative flex flex-col items-center justify-center space-y-4">
      <div className="relative w-full overflow-hidden rounded-lg border bg-muted aspect-[3/4]">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {hasCameraPermission === true && <div className="pointer-events-none absolute inset-0 border-[2px] border-dashed border-primary/70" />}
        {hasCameraPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center">
            <CameraOff className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-semibold">Camera Not Available</p>
            <p className="text-sm text-muted-foreground">Could not access camera. Please check permissions and browser support.</p>
          </div>
        )}
        {hasCameraPermission === null && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-muted-foreground">Requesting camera...</p>
          </div>
        )}
      </div>
      <Button onClick={handleCapture} disabled={!hasCameraPermission || disabled} className="w-full">
        <CameraIcon className="mr-2 h-4 w-4" />
        Take Picture
      </Button>
    </div>
  );
}