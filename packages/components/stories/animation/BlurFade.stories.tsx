import type { Meta, StoryObj } from '@storybook/react'
import { BlurFade } from '../../src/animation/blur-fade'

const meta = {
  title: 'Animation/BlurFade',
  component: BlurFade,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    delay: {
      control: { type: 'number', min: 0, max: 2, step: 0.1 },
    },
    duration: {
      control: { type: 'number', min: 0.1, max: 2, step: 0.1 },
    },
  },
} satisfies Meta<typeof BlurFade>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: <div className="text-4xl font-bold">Blur Fade Animation</div>,
    delay: 0,
    duration: 0.5,
  },
}

export const WithDelay: Story = {
  args: {
    children: <div className="text-4xl font-bold">Delayed Blur Fade</div>,
    delay: 0.5,
    duration: 0.5,
  },
}

export const SlowAnimation: Story = {
  args: {
    children: <div className="text-4xl font-bold">Slow Blur Fade</div>,
    delay: 0,
    duration: 1.5,
  },
}
