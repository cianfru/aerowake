import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, X, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadedFile } from '@/types/fatigue';
import { cn } from '@/lib/utils';

interface SidebarUploadProps {
  onFileUpload: (file: UploadedFile, actualFile: File) => void;
  uploadedFile: UploadedFile | null;
  onRemoveFile: () => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  hasResults: boolean;
}

export function SidebarUpload({ 
  onFileUpload, 
  uploadedFile, 
  onRemoveFile,
  onRunAnalysis,
  isAnalyzing,
  hasResults,
}: SidebarUploadProps) {
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
      }, file);
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
      }, file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4 text-primary" />
          Roster Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!uploadedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "relative rounded-lg border-2 border-dashed p-4 text-center transition-all duration-300",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-secondary/30"
            )}
          >
            <input
              type="file"
              accept=".pdf,.csv"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            
            <div className="flex flex-col items-center gap-2">
              <Upload className={cn(
                "h-6 w-6 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
              <div>
                <p className="text-xs font-medium">Drop roster file</p>
                <p className="text-[10px] text-muted-foreground">PDF or CSV</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Uploaded file display */}
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{uploadedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onRemoveFile} className="h-6 w-6 flex-shrink-0">
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Run Analysis Button */}
            <Button
              variant="glow"
              size="sm"
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-3 w-3" />
                  Run Analysis
                </>
              )}
            </Button>

            {hasResults && (
              <div className="flex items-center gap-1 text-success">
                <CheckCircle className="h-3 w-3" />
                <span className="text-[10px]">Analysis complete</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
