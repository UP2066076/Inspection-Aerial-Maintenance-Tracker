"use client";

import { useState, useCallback, ChangeEvent, DragEvent } from 'react';
import { useFormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileImage, X, AlertCircle } from 'lucide-react';
import { MAX_IMAGES } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      if (!event.target?.result) return reject(new Error("Could not read file."));
      const img = document.createElement('img');
      img.src = event.target.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 212;
        canvas.height = 283;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Could not get canvas context."));
        ctx.drawImage(img, 0, 0, 212, 283);
        resolve(canvas.toDataURL(file.type));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};


export function ImageUploader({ value = [], onChange }: { value: string[], onChange: (value: string[]) => void }) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const acceptedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (acceptedFiles.length !== files.length) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload only PNG or JPG images.' });
    }

    const filesToProcess = acceptedFiles.slice(0, MAX_IMAGES - value.length);

    if (value.length + acceptedFiles.length > MAX_IMAGES) {
       toast({ variant: 'destructive', title: 'Image limit reached', description: `You can only upload a maximum of ${MAX_IMAGES} images.` });
    }

    const resizedImages = await Promise.all(filesToProcess.map(resizeImage));
    onChange([...value, ...resizedImages]);
  }, [value, onChange, toast]);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeImage = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  return (
    <Card 
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={cn("border-2 border-dashed", isDragging ? 'border-primary' : 'border-input')}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {Array.from({ length: MAX_IMAGES }).map((_, index) => (
            <div key={index} className="aspect-[3/4] relative">
              {value[index] ? (
                <>
                  <Image src={value[index]} alt={`Upload preview ${index + 1}`} layout="fill" className="rounded-md object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-full rounded-md bg-muted/50 cursor-pointer hover:bg-muted">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                        <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="mb-1 text-xs text-muted-foreground">
                            Slot {index + 1}
                        </p>
                    </div>
                </label>
              )}
            </div>
          ))}
        </div>
        <Input id="image-upload" type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleInputChange} disabled={value.length >= MAX_IMAGES} />
        {value.length < MAX_IMAGES && (
            <div className="text-center mt-4">
                <p className="text-sm text-muted-foreground">Drag & drop images here or click on a slot to select files.</p>
                <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES - value.length} remaining.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
