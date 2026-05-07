import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { Upload, X, CheckCircle, Loader2 } from 'lucide-react';

type MediaCategory = 'before' | 'after';

interface Props {
  jobId: string;
  onUploadComplete: (fileInfo: {url: string, category: MediaCategory}) => void;
}

export default function JobMediaUpload({ jobId, onUploadComplete }: Props) {
  const [files, setFiles] = useState<{file: File, url?: string, category: MediaCategory, progress: number, status: 'uploading' | 'completed' | 'error'}[]>([]);

  const onDrop = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      category: 'before' as MediaCategory,
      progress: 0,
      status: 'uploading' as const
    }));
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(fileInfo => uploadFile(fileInfo));
  };

  const uploadFile = async (fileInfo: typeof files[0]) => {
    const file = fileInfo.file;
    const fileExt = file.name.split('.').pop();
    const fileName = `${jobId}/${fileInfo.category}/${Math.random()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('job-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      setFiles(prev => prev.map(f => f.file === file ? {...f, status: 'error'} : f));
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('job-media')
      .getPublicUrl(fileName);
    
    console.log("Generated URL:", publicUrlData.publicUrl);

    await supabase.from('job_media').insert({
      job_id: jobId,
      url: publicUrlData.publicUrl,
      category: fileInfo.category
    });

    setFiles(prev => prev.map(f => f.file === file ? {...f, url: publicUrlData.publicUrl, status: 'completed', progress: 100} : f));
    onUploadComplete({url: publicUrlData.publicUrl, category: fileInfo.category});
  };

  const handleCategoryChange = async (index: number, newCategory: MediaCategory) => {
    const fileInfo = files[index];
    
    console.log("[JobMediaUpload] Changing category for:", fileInfo.url || 'no-url', "to:", newCategory);
    setFiles(prev => prev.map((f, i) => i === index ? {...f, category: newCategory} : f));
    
    // Update category in database if URL exists
    if (fileInfo.url) {
      const { error } = await supabase.from('job_media')
        .update({ category: newCategory })
        .eq('url', fileInfo.url);

      if (error) {
        console.error("[JobMediaUpload] Supabase update error:", error);
      } else {
        console.log("[JobMediaUpload] Supabase update successful");
      }
    }

    // Always call onUploadComplete to update parent state
    onUploadComplete({url: fileInfo.url, category: newCategory});
  };

  const { getRootProps, getInputProps, isDragActive } = (useDropzone as any)({ onDrop });

  return (
    <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl">
      <div {...getRootProps()} className="cursor-pointer text-center p-4">
        <input {...getInputProps()} />
        <Upload className="mx-auto w-8 h-8 text-slate-400" />
        <p className="text-sm text-slate-600 mt-2">Drag & drop files or click to upload</p>
      </div>
      
      <div className="mt-4 space-y-2">
        {files.map((fileInfo, index) => (
          <div key={`${fileInfo.file.name}-${index}`} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
            <span className="truncate">{fileInfo.file.name}</span>
            <select 
              value={fileInfo.category}
              onChange={(e) => handleCategoryChange(index, e.target.value as MediaCategory)}
              className="text-xs border rounded p-1"
            >
              <option value="before">Before</option>
              <option value="after">After</option>
            </select>
            {fileInfo.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
            {fileInfo.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}
