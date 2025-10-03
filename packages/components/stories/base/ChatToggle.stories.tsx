import type { Meta, StoryObj } from '@storybook/react'
import { ChatToggle } from '../../src/base/chat-toggle'

const meta = {
  title: 'Base/ChatToggle',
  component: ChatToggle,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
