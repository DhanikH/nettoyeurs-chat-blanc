import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Media {
  id: string;
  url: string;
  category: 'before' | 'after';
}

interface Props {
  jobId: string;
  media: Media[];
  onDelete: (mediaId: string) => void;
}

export default function JobMediaDisplay({ jobId, media, onDelete }: Props) {
  const handleDelete = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/media/${mediaId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDelete(mediaId);
      } else {
        console.error("Failed to delete media");
      }
    } catch (err) {
      console.error("Error deleting media:", err);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {media.map((item) => (
        <div key={item.id} className="relative group">
          <img src={item.url} alt={item.category} className="w-full h-24 object-cover rounded-lg" referrerPolicy="no-referrer" />
          <button
            onClick={() => handleDelete(item.id)}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
