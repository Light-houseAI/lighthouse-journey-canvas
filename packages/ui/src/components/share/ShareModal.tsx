/**
 * ShareModal Component
 *
 * Modal for managing sharing permissions with Networks and People tabs
 * Based on Figma design: simplified UI with predefined network groups
 */

import { Share2, Link, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@journey/components';
import { Dialog, DialogContent } from '@journey/components';
import { useShareStore } from '../../stores/share-store';
import { useToast } from '../../hooks/use-toast';

import { ShareMainView } from './ShareMainView';
import { useAuthStore } from '../../stores';

export const ShareModal: React.FC = () => {
  const { toast } = useToast();
  const {
    isModalOpen,
    closeModal,
    fetchCurrentPermissions,
    config,
    userNodes,
  } = useShareStore();
  const [activeTab, setActiveTab] = useState<'networks' | 'people'>('networks');
  const [isPermissionViewOpen, setIsPermissionViewOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Fetch current permissions when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const nodeIds = config.shareAllNodes
        ? userNodes.map((node) => node.id)
        : config.selectedNodes;

      if (nodeIds.length > 0) {
        fetchCurrentPermissions(nodeIds);
      }
    }
  }, [
    isModalOpen,
    config.shareAllNodes,
    config.selectedNodes,
    userNodes,
    fetchCurrentPermissions,
  ]);

  const handleCopyShareLink = () => {
    // Copy share link to clipboard
    const shareLink = `${window.location.origin}/profile/${user?.userName}`;
    navigator.clipboard.writeText(shareLink);

    toast({
      title: 'Link copied!',
      description: 'Share link has been copied to clipboard',
    });
  };

  if (!isModalOpen) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={closeModal}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 bg-white p-0">
        {/* Header */}
        <div className="relative border-b border-gray-200">
          <div className="flex gap-4 p-6 pb-5">
            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-gray-200 bg-white shadow-sm">
              <Share2 className="h-6 w-6 text-gray-700" />
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Share my journey
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Let your progress be an inspiration to others.
              </p>
            </div>

            {/* Close Button */}
            <Button
              onClick={closeModal}
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-6 w-6 rounded-lg p-2.5 transition-colors hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-5">
          <ShareMainView
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onPermissionViewChange={setIsPermissionViewOpen}
          />
        </div>

        {/* Footer - only show when not in permission view */}
        {!isPermissionViewOpen && (
          <div className="border-t border-gray-200 bg-white p-6">
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={closeModal}
                className="px-5 py-3 font-semibold"
              >
                Close
              </Button>
              <Button
                onClick={handleCopyShareLink}
                className="bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800"
              >
                <Link className="mr-2 h-[18px] w-[18px]" />
                Copy share link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
