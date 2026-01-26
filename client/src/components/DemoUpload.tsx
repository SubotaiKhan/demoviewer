import { useState, useRef, useCallback } from 'react';
import { uploadDemo } from '../api';

interface Props {
    onUploadComplete: () => void;
    adminPassword: string;
}

export const DemoUpload: React.FC<Props> = ({ onUploadComplete, adminPassword }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        if (!file.name.endsWith('.dem')) {
            setError('Only .dem files are allowed');
            return;
        }

        setError(null);
        setUploading(true);
        setProgress(0);

        try {
            await uploadDemo(file, adminPassword, setProgress);
            onUploadComplete();
        } catch (err: any) {
            const message = err.response?.data?.error || 'Upload failed';
            setError(message);
        } finally {
            setUploading(false);
            setProgress(0);
        }
    }, [onUploadComplete]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleClick = () => fileInputRef.current?.click();

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="mt-4">
            <div
                onClick={!uploading ? handleClick : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    isDragging
                        ? 'border-cs2-accent bg-cs2-accent/10'
                        : 'border-gray-600 hover:border-gray-400'
                } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dem"
                    onChange={handleFileInput}
                    className="hidden"
                />

                {uploading ? (
                    <div>
                        <p className="text-sm text-gray-400 mb-2">Uploading... {progress}%</p>
                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cs2-accent transition-all duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400">
                        Drop a <span className="text-white font-mono">.dem</span> file here or click to browse
                    </p>
                )}
            </div>

            {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
        </div>
    );
};
