import type { Meta, StoryObj } from '@storybook/react'
import { InteractiveHoverButton } from '../../src/animation/interactive-hover-button'

const meta = {
  title: 'Animation/InteractiveHoverButton',
  component: InteractiveHoverButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof InteractiveHoverButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Hover Me',
  },
}
