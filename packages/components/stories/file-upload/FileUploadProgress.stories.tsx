import type { Meta, StoryObj } from '@storybook/react';

import { FileUploadProgress } from '../../src/file-upload/file-upload-progress';

const meta: Meta<typeof FileUploadProgress> = {
  title: 'File Upload/FileUploadProgress',
  component: FileUploadProgress,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['idle', 'uploading', 'processing', 'success', 'error'],
    },
    progress: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileUploadProgress>;

export const Uploading: Story = {
  args: {
    filename: 'resume.pdf',
    sizeBytes: 2_500_000, // 2.5 MB
    status: 'uploading',
    progress: 45,
  },
};

export const Processing: Story = {
  args: {
    filename: 'resume.pdf',
    sizeBytes: 2_500_000,
    status: 'processing',
    progress: 100,
  },
};

export const Success: Story = {
  args: {
    filename: 'resume.pdf',
    sizeBytes: 2_500_000,
    status: 'success',
    progress: 100,
  },
};

export const Error: Story = {
  args: {
    filename: 'resume.pdf',
    sizeBytes: 2_500_000,
    status: 'error',
    progress: 0,
    error: 'Upload failed due to network error',
  },
};

export const LargeFile: Story = {
  args: {
    filename: 'large-document.pdf',
    sizeBytes: 9_800_000, // 9.8 MB
    status: 'uploading',
    progress: 75,
  },
};

export const SmallFile: Story = {
  args: {
    filename: 'small-doc.pdf',
    sizeBytes: 500_000, // 0.5 MB
    status: 'success',
    progress: 100,
  },
};
