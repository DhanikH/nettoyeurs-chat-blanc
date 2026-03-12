import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Trash2, User, Clock } from 'lucide-react';
import { formatDate, formatTime, formatDateTime } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

interface Note {
  id: string;
  customer_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface CustomerNotesProps {
  customerId: string;
  customerName?: string;
}

export const CustomerNotes: React.FC<CustomerNotesProps> = ({ customerId, customerName }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [customerId]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !user) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: user.id,
          content: newNote.trim(),
        }),
      });

      if (response.ok) {
        setNewNote('');
        fetchNotes();
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!user) return;
    if (!window.confirm(t('dashboard.confirm_delete_note'))) return;

    try {
      const response = await fetch(`/api/customer-notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: user.id,
          user_role: user.role,
        }),
      });

      if (response.ok) {
        fetchNotes();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-lg"></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4 border-bottom border-gray-100 bg-gray-50 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">
          {t('dashboard.customer_notes')} {customerName ? `- ${customerName}` : ''}
        </h3>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={t('dashboard.add_note_placeholder')}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none min-h-[100px]"
            />
            <button
              type="submit"
              disabled={submitting || !newNote.trim()}
              className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          <AnimatePresence initial={false}>
            {notes.length === 0 ? (
              <p className="text-center text-gray-500 py-8 italic">
                {t('dashboard.no_notes_yet')}
              </p>
            ) : (
              notes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-100 relative group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <User className="w-4 h-4 text-indigo-500" />
                      {note.author_name}
                      {note.author_id === user?.id && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                          {t('dashboard.you')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(new Date(note.created_at))}
                    </div>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                    {note.content}
                  </p>
                  
                  {(user?.role === 'admin' || user?.id === note.author_id) && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-50"
                      title={t('dashboard.delete_note')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
