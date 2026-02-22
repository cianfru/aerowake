import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadedFile } from '@/types/fatigue';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUpload: (file: UploadedFile) => void;
  uploadedFile: UploadedFile | null;
  onRemoveFile: () => void;
}

export function FileUpload({ onFileUpload, uploadedFile, onRemoveFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      onFileUpload({
        name: file.name,
        size: file.size,
        type: file.type.includes('pdf') ? 'PDF' : 'CSV',
      });
    }
  }, [onFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      onFileUpload({
        name: file.name,
        size: file.size,
        type: file.type.includes('pdf') ? 'PDF' : 'CSV',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary">📄</span>
          Step 1: Upload Roster
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Choose your roster file</p>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-secondary/30",
            uploadedFile && "border-success bg-success/5"
          )}
        >
          <input
            type="file"
            accept=".pdf,.csv"
            onChange={handleFileSelect}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          
          <div className="flex flex-col items-center gap-3">
            {uploadedFile ? (
              <CheckCircle className="h-10 w-10 text-success" />
            ) : (
              <Upload className={cn(
                "h-10 w-10 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            )}
            
            <div>
              <p className="font-medium">
                {uploadedFile ? uploadedFile.name : 'Drag and drop file here'}
              </p>
              <p className="text-sm text-muted-foreground">
                Limit 200MB per file • PDF, CSV
              </p>
            </div>
          </div>
        </div>

        {uploadedFile && (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onRemoveFile} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">File uploaded: {uploadedFile.name}</span>
            </div>

            <Card variant="elevated" className="bg-secondary/30">
              <CardContent className="p-4">
                <h4 className="mb-2 text-sm font-medium text-primary">📋 File Details</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="text-foreground">Name:</span> {uploadedFile.name}</p>
                  <p><span className="text-foreground">Size:</span> {formatFileSize(uploadedFile.size)}</p>
                  <p><span className="text-foreground">Type:</span> {uploadedFile.type}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
