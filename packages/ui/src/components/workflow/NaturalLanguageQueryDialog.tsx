/**
 * Natural Language Query Dialog Component
 *
 * A dialog/modal wrapper for the NaturalLanguageQueryPanel that opens
 * when the user clicks on "Ask About Your Work" link.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@journey/components';
import { Search } from 'lucide-react';

import { NaturalLanguageQueryPanel } from './NaturalLanguageQueryPanel';

interface NaturalLanguageQueryDialogProps {
  nodeId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function NaturalLanguageQueryDialog({
  nodeId,
  isOpen,
  onClose,
}: NaturalLanguageQueryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
              <Search size={18} className="text-white" />
            </div>
            Ask About Your Work
          </DialogTitle>
          <DialogDescription>
            Search your work history using natural language with Graph RAG + Vector Search
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-6 px-6">
          <NaturalLanguageQueryPanel nodeId={nodeId} onClose={onClose} hideHeader />
        </div>
      </DialogContent>
    </Dialog>
  );
}
