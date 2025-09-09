import React, { useState, useCallback, useEffect } from 'react';
import { editImage, EditImageResult } from './services/geminiService';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// --- HELPER & UI COMPONENTS ---

const UploadIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
);

const DownloadIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const RetryIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 0114.65 8.36l3.182-3.182m0 0h-4.992m4.992 0v4.992" />
    </svg>
);

const Spinner: React.FC<{className?: string}> = ({ className = "h-12 w-12 border-t-2 border-b-2 border-blue-500" }) => (
    <div className={`animate-spin rounded-full ${className}`}></div>
);

const ZoomableImageModal: React.FC<{
    imageUrl: string;
    title: string;
    isOpen: boolean;
    onClose: () => void;
}> = ({ imageUrl, title, isOpen, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="zoom-modal-title">
            <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h2 id="zoom-modal-title" className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-white text-3xl hover:text-gray-300 transition-colors" aria-label="Cerrar vista de zoom">&times;</button>
                </div>
                
                <TransformWrapper>
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <div className="absolute top-14 left-2 z-10 flex flex-col gap-2">
                                <button onClick={() => zoomIn()} className="bg-white/80 p-2 rounded-full shadow-lg hover:bg-white transition" aria-label="Acercar"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                                <button onClick={() => zoomOut()} className="bg-white/80 p-2 rounded-full shadow-lg hover:bg-white transition" aria-label="Alejar"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                                <button onClick={() => resetTransform()} className="bg-white/80 p-2 rounded-full shadow-lg hover:bg-white transition" aria-label="Restablecer zoom"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 20L20 4" /></svg></button>
                            </div>
                            <div className="flex-grow bg-black/50 rounded-lg overflow-hidden border border-gray-600">
                                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                                    <img src={imageUrl} alt={`Vista ampliada de ${title}`} className="w-full h-full object-contain cursor-grab" />
                                </TransformComponent>
                            </div>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </div>
    );
};


// --- BATCH PROCESSING TYPES & COMPONENTS ---

type ProcessStatus = 'pending' | 'processing' | 'completed' | 'error';

interface ProcessedImage {
    id: string;
    file: File;
    originalUrl: string;
    editedUrl: string | null;
    text: string | null;
    status: ProcessStatus;
    error?: string;
}

const ResultCard: React.FC<{
    result: ProcessedImage;
    onZoom: (imageUrl: string, title: string) => void;
    onDownload: (imageUrl: string, filename: string) => void;
    onRetry: (id: string) => void;
}> = ({ result, onZoom, onDownload, onRetry }) => {
    
    const ImagePreview: React.FC<{ src: string, alt: string, title: string, isZoomable: boolean, children?: React.ReactNode }> = ({ src, alt, title, isZoomable, children }) => (
        <button 
            className="w-full h-full group disabled:cursor-default" 
            onClick={() => isZoomable && onZoom(src, title)}
            disabled={!isZoomable}
            aria-label={`Ampliar imagen ${title}`}
        >
            <img src={src} alt={alt} className="w-full h-full object-cover" />
            {isZoomable && (
                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                 </div>
            )}
            {children}
        </button>
    );
    
    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border flex flex-col">
            <div className="grid grid-cols-2">
                <div className="relative aspect-square border-r">
                   <ImagePreview src={result.originalUrl} alt={`Original - ${result.file.name}`} title={`Original - ${result.file.name}`} isZoomable={true} />
                </div>
                <div className="relative aspect-square bg-gray-50">
                    {result.status === 'completed' && result.editedUrl && (
                        <ImagePreview src={result.editedUrl} alt={`Mejorada - ${result.file.name}`} title={`Mejorada - ${result.file.name}`} isZoomable={true}>
                             {/* Action Buttons Container */}
                             <div className="absolute inset-0 pointer-events-none">
                                {(result.status === 'completed' || result.status === 'error') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRetry(result.id); }}
                                        className="absolute bottom-2 left-2 bg-white/90 p-2 rounded-full shadow-lg hover:bg-white transition pointer-events-auto"
                                        title="Reintentar con nueva descripción"
                                        aria-label="Reintentar con nueva descripción"
                                    >
                                        <RetryIcon className="h-5 w-5 text-gray-800" />
                                    </button>
                                )}
                                {result.status === 'completed' && result.editedUrl && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDownload(result.editedUrl!, `mejorada-${result.file.name}`); }}
                                        className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-lg hover:bg-white transition pointer-events-auto"
                                        title="Descargar imagen mejorada"
                                        aria-label="Descargar imagen mejorada"
                                    >
                                        <DownloadIcon className="h-5 w-5 text-gray-800" />
                                    </button>
                                )}
                            </div>
                        </ImagePreview>
                    )}
                    {result.status === 'processing' && (
                        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center p-2 text-center">
                            <Spinner className="h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                            <p className="mt-2 text-xs text-gray-600 font-semibold">Procesando...</p>
                        </div>
                    )}
                     {result.status === 'pending' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-gray-400 text-sm">En espera</p>
                        </div>
                    )}
                    {result.status === 'error' && (
                        <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center p-2 text-center">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="mt-2 text-xs text-red-700 font-semibold">Error</p>
                            <p className="mt-1 text-xs text-red-600 truncate" title={result.error}>{result.error}</p>
                             <button
                                onClick={() => onRetry(result.id)}
                                className="mt-3 bg-white text-gray-800 text-xs font-semibold py-1 px-2 rounded-md hover:bg-gray-100 transition-all flex items-center gap-1 shadow border border-gray-200"
                                aria-label="Volver a intentar la mejora de la imagen"
                            >
                                <RetryIcon className="h-4 w-4" />
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>
            </div>
             <div className="p-3 bg-gray-50 border-t">
                <p className="text-xs text-gray-600 truncate font-medium" title={result.file.name}>{result.file.name}</p>
                 {result.status === 'completed' && result.text && (
                    <p className="text-xs text-blue-800 mt-1"><strong className="font-semibold">IA:</strong> {result.text}</p>
                )}
            </div>
        </div>
    );
};

const RetryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newPrompt: string) => void;
    image: ProcessedImage;
    initialPrompt: string;
}> = ({ isOpen, onClose, onConfirm, image, initialPrompt }) => {
    const [newPrompt, setNewPrompt] = useState(initialPrompt);

    useEffect(() => {
        if (isOpen) {
            setNewPrompt(initialPrompt); 
        }
    }, [isOpen, initialPrompt]);

    const handleConfirm = () => {
        if (newPrompt.trim()) {
            onConfirm(newPrompt);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="retry-modal-title">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 id="retry-modal-title" className="text-xl font-bold text-gray-800">Reintentar Mejora</h2>
                    <button onClick={onClose} className="text-gray-500 text-3xl hover:text-gray-800 transition-colors" aria-label="Cerrar modal">&times;</button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-700 mb-2">Imagen Original</span>
                        <div className="aspect-square rounded-lg overflow-hidden border">
                             <img src={image.originalUrl} alt={`Original - ${image.file.name}`} className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                         <label htmlFor="retry-prompt" className="font-semibold text-gray-700 mb-2">Mejora la descripción</label>
                         <textarea
                            id="retry-prompt"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            rows={8}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm text-sm"
                            placeholder="Ej: 'Haz que la habitación sea más luminosa y moderna'..."
                         />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold">Cancelar</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={!newPrompt.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-bold flex items-center gap-2"
                    >
                        ✨ Mejorar de Nuevo
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [results, setResults] = useState<ProcessedImage[]>([]);
    const [prompt, setPrompt] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [processingIndex, setProcessingIndex] = useState<number>(0);
    const [modalState, setModalState] = useState<{isOpen: boolean; imageUrl: string; title: string} | null>(null);
    const [retryState, setRetryState] = useState<{ isOpen: boolean; image: ProcessedImage | null }>({ isOpen: false, image: null });

    const presets = [
        'Haz la habitación más luminosa y moderna',
        'Añade muebles de estilo escandinavo',
        'Cambia el suelo a madera clara',
        'Quita los muebles de la habitación y pinta las paredes de blanco',
        'Decora para una casa de lujo',
    ];

    const processFiles = (files: FileList | null) => {
        if (files && files.length > 0) {
            const fileList = Array.from(files);
            setImageFiles(fileList);
            
            const newResults: ProcessedImage[] = fileList.map((file, index) => ({
                id: `${file.name}-${file.lastModified}-${index}`,
                file,
                originalUrl: URL.createObjectURL(file),
                editedUrl: null,
                text: null,
                status: 'pending'
            }));
            setResults(newResults);
            setError(null);
        }
    };
    
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(event.target.files);
    };

    const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation(); // Necessary to allow drop.
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        processFiles(event.dataTransfer.files);
    };

    const handleSubmit = useCallback(async () => {
        if (imageFiles.length === 0 || !prompt.trim()) {
            setError('Por favor, sube al menos una imagen y escribe las instrucciones de mejora.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setProcessingIndex(0);

        for (let i = 0; i < imageFiles.length; i++) {
            setProcessingIndex(i);
            const currentFile = imageFiles[i];
            
            setResults(prev => prev.map((res, index) => i === index ? { ...res, status: 'processing', error: undefined } : res));

            try {
                const result: EditImageResult = await editImage(currentFile, prompt);
                 if(!result.imageUrl && !result.text) {
                    throw new Error("La IA no devolvió contenido. Intenta de nuevo.");
                }
                setResults(prev => prev.map((res, index) => i === index ? { ...res, status: 'completed', editedUrl: result.imageUrl, text: result.text } : res));
            } catch (err: any) {
                setResults(prev => prev.map((res, index) => i === index ? { ...res, status: 'error', error: err.message || 'Error desconocido' } : res));
            }
        }

        setIsLoading(false);
    }, [imageFiles, prompt]);

    const handleOpenRetryModal = (id: string) => {
        const imageToRetry = results.find(r => r.id === id);
        if (imageToRetry) {
            setRetryState({ isOpen: true, image: imageToRetry });
        }
    };

    const handleConfirmRetry = useCallback(async (newPrompt: string) => {
        if (!retryState.image) return;

        const { id, file } = retryState.image;
        setRetryState({ isOpen: false, image: null });
        setError(null);

        setResults(prev => prev.map(res => 
            res.id === id ? { ...res, status: 'processing', error: undefined } : res
        ));

        try {
            const result: EditImageResult = await editImage(file, newPrompt);
            if (!result.imageUrl && !result.text) {
                throw new Error("La IA no devolvió contenido. Intenta de nuevo.");
            }
            setResults(prev => prev.map(res => 
                res.id === id ? { ...res, status: 'completed', editedUrl: result.imageUrl, text: result.text } : res
            ));
        } catch (err: any) {
            setResults(prev => prev.map(res => 
                res.id === id ? { ...res, status: 'error', error: err.message || 'Error desconocido' } : res
            ));
        }
    }, [retryState.image]);
    
    const handleZoom = (imageUrl: string, title: string) => {
        setModalState({ isOpen: true, imageUrl, title });
    };

    const handleDownload = useCallback((imageUrl: string, filename: string) => {
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    return (
        <div className="bg-gray-50 min-h-screen text-gray-800 font-sans">
            <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
                <div className="container mx-auto flex items-center gap-3">
                     <svg className="h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436A6.75 6.75 0 019.75 22.5a.75.75 0 01-.75-.75v-7.192A4.5 4.5 0 012.25 10.5a.75.75 0 01.75-.75c2.69 0 4.96.992 6.315 2.634 1.356-1.642 3.626-2.634 6.315-2.634a.75.75 0 010 1.5 4.5 4.5 0 01-4.5 4.5.75.75 0 01-.75-.75v-1.543A6.712 6.712 0 019.315 7.584z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-2xl font-bold text-gray-800">Mejorador de Imágenes IA por Lotes</h1>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <span className="text-lg font-semibold text-gray-700 block mb-2">1. Sube tus Imágenes</span>
                            <label 
                                htmlFor="image-upload" 
                                className="cursor-pointer group mt-1"
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            >
                                <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-blue-600 bg-blue-100' : 'border-gray-300 group-hover:border-blue-500 group-hover:bg-blue-50'}`}>
                                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                    <p className="mt-2 text-sm text-gray-600 font-medium">
                                        {isDragging
                                            ? 'Suelta las imágenes aquí'
                                            : imageFiles.length > 0
                                                ? `${imageFiles.length} archivo(s) seleccionado(s)`
                                                : 'Arrastra y suelta o haz clic para seleccionar'
                                        }
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP hasta 10MB</p>
                                </div>
                                <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} multiple />
                            </label>
                        </div>

                        <div>
                            <label htmlFor="prompt" className="text-lg font-semibold text-gray-700 block mb-2">2. Describe la Mejora (para todas)</label>
                             <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-2 font-medium">Ajustes rápidos:</p>
                                <div className="flex flex-wrap gap-2">
                                    {presets.map((presetText, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setPrompt(presetText)}
                                            className="bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
                                            title={`Usar este ajuste: "${presetText}"`}
                                        >
                                            {presetText}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                id="prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={5}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                placeholder="O escribe tu propia mejora detallada aquí..."
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <button
                            onClick={handleSubmit}
                            disabled={imageFiles.length === 0 || !prompt.trim() || isLoading}
                            className="w-full md:w-1/2 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            {isLoading ? (
                                <>
                                <Spinner className="h-5 w-5 border-t-2 border-b-2 border-white" />
                                <span>Procesando... ({processingIndex + 1}/{imageFiles.length})</span>
                                </>
                            ) : (
                                '✨ Mejorar Imágenes'
                            )}
                        </button>
                        {error && <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm w-full md:w-1/2" role="alert">{error}</div>}
                    </div>
                </div>

                {results.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-2xl font-bold text-center mb-6">Resultados</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {results.map(result => (
                                <ResultCard 
                                    key={result.id} 
                                    result={result} 
                                    onZoom={handleZoom} 
                                    onDownload={handleDownload}
                                    onRetry={handleOpenRetryModal}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {modalState?.isOpen && (
                <ZoomableImageModal 
                    isOpen={modalState.isOpen} 
                    onClose={() => setModalState(null)} 
                    imageUrl={modalState.imageUrl} 
                    title={modalState.title} 
                />
            )}

            {retryState.isOpen && retryState.image && (
                <RetryModal
                    isOpen={retryState.isOpen}
                    onClose={() => setRetryState({ isOpen: false, image: null })}
                    onConfirm={handleConfirmRetry}
                    image={retryState.image}
                    initialPrompt={prompt}
                />
            )}
        </div>
    );
};

export default App;
