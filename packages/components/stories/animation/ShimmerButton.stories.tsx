import type { Meta, StoryObj } from '@storybook/react';
import { ShimmerButton } from '../../src/animation/shimmer-button';

const meta = {
  title: 'Animation/ShimmerButton',
  component: ShimmerButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ShimmerButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Shimmer Button',
  },
};

export const WithCustomColors: Story = {
  args: {
    children: 'Custom Shimmer',
    className: 'bg-gradient-to-r from-purple-500 to-pink-500',
    shimmerColor: '#a02b9b',
  },
};
