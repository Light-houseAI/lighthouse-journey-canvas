import type { Meta, StoryObj } from '@storybook/react'
import { AnimatedSubscribeButton } from '../../src/animation/animated-subscribe-button'

const meta = {
  title: 'Animation/AnimatedSubscribeButton',
  component: AnimatedSubscribeButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof AnimatedSubscribeButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    subscribeStatus: false,
    children: [
      <span key="initial">Subscribe</span>,
      <span key="change">Subscribed</span>,
    ],
  },
}
