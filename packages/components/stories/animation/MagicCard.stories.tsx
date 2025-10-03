import type { Meta, StoryObj } from '@storybook/react'
import { MagicCard } from '../../src/animation/magic-card'

const meta = {
  title: 'Animation/MagicCard',
  component: MagicCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof MagicCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <MagicCard className="w-[300px] h-[200px] flex items-center justify-center">
      <p className="text-2xl font-bold">Magic Card</p>
    </MagicCard>
  ),
}
