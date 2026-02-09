/**
 * Template Editor Modal
 *
 * Modal dialog for creating and editing slash templates.
 * Allows editing all fields: name, description, query, prompt preview, icon, and color.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, FileText, BookOpen, Rocket, Sparkles, Zap, Brain, Target, Lightbulb } from 'lucide-react';
import {
  useTemplateStore,
  COLOR_PRESETS,
  type StoredTemplate,
  type TemplateIconKey,
  type TemplateColorPreset,
} from '../../stores/template-store';

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Template to edit. If null, creating a new template. */
  editingTemplate: StoredTemplate | null;
}

// ============================================================================
// ICON OPTIONS
// ============================================================================

const ICON_OPTIONS: { key: TemplateIconKey; Icon: typeof FileText; label: string }[] = [
  { key: 'FileText', Icon: FileText, label: 'Document' },
  { key: 'BookOpen', Icon: BookOpen, label: 'Book' },
  { key: 'Rocket', Icon: Rocket, label: 'Rocket' },
  { key: 'Sparkles', Icon: Sparkles, label: 'Sparkles' },
  { key: 'Zap', Icon: Zap, label: 'Zap' },
  { key: 'Brain', Icon: Brain, label: 'Brain' },
  { key: 'Target', Icon: Target, label: 'Target' },
  { key: 'Lightbulb', Icon: Lightbulb, label: 'Lightbulb' },
];

const COLOR_OPTIONS: { key: TemplateColorPreset; label: string; swatch: string }[] = [
  { key: 'blue', label: 'Blue', swatch: 'bg-blue-500' },
  { key: 'purple', label: 'Purple', swatch: 'bg-purple-500' },
  { key: 'orange', label: 'Orange', swatch: 'bg-orange-500' },
  { key: 'green', label: 'Green', swatch: 'bg-green-500' },
  { key: 'red', label: 'Red', swatch: 'bg-red-500' },
  { key: 'amber', label: 'Amber', swatch: 'bg-amber-500' },
  { key: 'teal', label: 'Teal', swatch: 'bg-teal-500' },
  { key: 'pink', label: 'Pink', swatch: 'bg-pink-500' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TemplateEditorModal({
  isOpen,
  onClose,
  editingTemplate,
}: TemplateEditorModalProps) {
  const { addTemplate, updateTemplate } = useTemplateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [promptPreview, setPromptPreview] = useState('');
  const [iconKey, setIconKey] = useState<TemplateIconKey>('FileText');
  const [colorPreset, setColorPreset] = useState<TemplateColorPreset>('blue');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isEditing = editingTemplate !== null;

  // Populate form when editing
  useEffect(() => {
    if (isOpen && editingTemplate) {
      setName(editingTemplate.name);
      setDescription(editingTemplate.description);
      setQuery(editingTemplate.query);
      setPromptPreview(editingTemplate.promptPreview);
      setIconKey(editingTemplate.iconKey);
      setColorPreset(editingTemplate.colorPreset);
      setErrors({});
    } else if (isOpen) {
      setName('');
      setDescription('');
      setQuery('');
      setPromptPreview('');
      setIconKey('FileText');
      setColorPreset('blue');
      setErrors({});
    }
  }, [isOpen, editingTemplate]);

  // Focus name input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!query.trim()) newErrors.query = 'Prompt query is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, query, description]);

  const handleSave = useCallback(() => {
    if (!validate()) return;

    const preview = promptPreview.trim() || `Prompt: ${name.trim()}\n\n${description.trim()}`;

    if (isEditing && editingTemplate) {
      updateTemplate(editingTemplate.id, {
        name: name.trim(),
        description: description.trim(),
        query: query.trim(),
        promptPreview: preview,
        iconKey,
        colorPreset,
      });
    } else {
      addTemplate({
        name: name.trim(),
        description: description.trim(),
        query: query.trim(),
        promptPreview: preview,
        iconKey,
        colorPreset,
      });
    }

    onClose();
  }, [validate, isEditing, editingTemplate, name, description, query, promptPreview, iconKey, colorPreset, updateTemplate, addTemplate, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditing ? 'Edit Template' : 'Create Template'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Template Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sprint Retrospective"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Generate a sprint retrospective from recent sessions"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 ${
                errors.description ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
          </div>

          {/* Query (the prompt sent to the server) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Prompt Query <span className="text-red-400">*</span>
            </label>
            <p className="mb-1.5 text-xs text-gray-400">
              The actual prompt text sent to the AI when this template is used.
            </p>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Analyze my recent workflow sessions and create a sprint retrospective..."
              rows={4}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 ${
                errors.query ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
            {errors.query && <p className="mt-1 text-xs text-red-500">{errors.query}</p>}
          </div>

          {/* Prompt Preview (shown when user expands the chevron) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Prompt Preview <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <p className="mb-1.5 text-xs text-gray-400">
              Readable summary shown when user expands the template. Auto-generated if left blank.
            </p>
            <textarea
              value={promptPreview}
              onChange={(e) => setPromptPreview(e.target.value)}
              placeholder="Prompt: Template Name&#10;&#10;Describes what this template does..."
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Icon + Color Row */}
          <div className="flex gap-4">
            {/* Icon Selector */}
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setIconKey(key)}
                    title={label}
                    className={`rounded-lg p-2 transition-all ${
                      iconKey === key
                        ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-300'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selector */}
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(({ key, label, swatch }) => (
                  <button
                    key={key}
                    onClick={() => setColorPreset(key)}
                    title={label}
                    className={`h-7 w-7 rounded-full ${swatch} transition-all ${
                      colorPreset === key
                        ? 'ring-2 ring-offset-2 ring-indigo-400'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isEditing ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditorModal;
