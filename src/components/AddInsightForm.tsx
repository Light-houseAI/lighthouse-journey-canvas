import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bold, Italic, Underline, Link, Image, Paperclip, Smile, Eye, EyeOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddInsightFormProps {
  onBack: () => void;
  onSave: (insight: {
    title: string;
    content: string;
    visibility: 'private' | 'connections' | 'public';
  }) => void;
}

const AddInsightForm: React.FC<AddInsightFormProps> = ({ onBack, onSave }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'connections' | 'public'>('private');

  const handleSave = () => {
    if (title.trim() && content.trim()) {
      onSave({ title: title.trim(), content: content.trim(), visibility });
    }
  };

  const getVisibilityIcon = (value: string) => {
    switch (value) {
      case 'private': return <EyeOff className="w-4 h-4" />;
      case 'connections': return <Users className="w-4 h-4" />;
      case 'public': return <Eye className="w-4 h-4" />;
      default: return <EyeOff className="w-4 h-4" />;
    }
  };

  const getVisibilityLabel = (value: string) => {
    switch (value) {
      case 'private': return 'Only Me';
      case 'connections': return 'My Connections';
      case 'public': return 'Public';
      default: return 'Only Me';
    }
  };

  return (
    <motion.div
      key="add-insight"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b border-white/10">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white/80" />
        </button>
        <h2 className="text-lg font-medium text-white">
          Add My Insight
        </h2>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Title Field */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter insight title..."
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-primary/50 focus:ring-primary/20"
            />
          </div>

          {/* Content Area */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Content
            </label>
            <div className="space-y-3">
              {/* Rich Text Toolbar */}
              <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg">
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Bold className="w-4 h-4 text-white/70" />
                </button>
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Italic className="w-4 h-4 text-white/70" />
                </button>
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Underline className="w-4 h-4 text-white/70" />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Link className="w-4 h-4 text-white/70" />
                </button>
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Image className="w-4 h-4 text-white/70" />
                </button>
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Paperclip className="w-4 h-4 text-white/70" />
                </button>
                <button className="p-2 rounded hover:bg-white/10 transition-colors">
                  <Smile className="w-4 h-4 text-white/70" />
                </button>
              </div>

              {/* Text Area */}
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your insights about this milestone..."
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-primary/50 focus:ring-primary/20 min-h-[120px] resize-none"
              />
            </div>
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Visibility
            </label>
            <Select value={visibility} onValueChange={(value: 'private' | 'connections' | 'public') => setVisibility(value)}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white focus:border-primary/50 focus:ring-primary/20">
                <div className="flex items-center gap-2">
                  {getVisibilityIcon(visibility)}
                  <SelectValue placeholder="Choose visibility" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-white/20">
                <SelectItem value="private" className="text-white hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4" />
                    <span>Only Me</span>
                  </div>
                </SelectItem>
                <SelectItem value="connections" className="text-white hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>My Connections</span>
                  </div>
                </SelectItem>
                <SelectItem value="public" className="text-white hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>Public</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-white/50 mt-1">
              {visibility === 'private' && 'Only you can see this insight'}
              {visibility === 'connections' && 'Your connections can see this insight'}
              {visibility === 'public' && 'Everyone can see this insight'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-white/10 p-6">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1 border-white/20 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Add Insight
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default AddInsightForm;