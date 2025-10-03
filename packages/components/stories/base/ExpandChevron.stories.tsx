import type { Meta, StoryObj } from '@storybook/react'
import { ExpandChevron } from '../../src/base/expand-chevron'

const meta = {
  title: 'Base/ExpandChevron',
  component: ExpandChevron,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ExpandChevron>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    expanded: false,
  },
}

export const Expanded: Story = {
  args: {
    expanded: true,
  },
}
