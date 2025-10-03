import type { Meta, StoryObj } from '@storybook/react'
import { RippleButton } from '../../src/animation/ripple-button'

const meta = {
  title: 'Animation/RippleButton',
  component: RippleButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof RippleButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Click Me',
  },
}
