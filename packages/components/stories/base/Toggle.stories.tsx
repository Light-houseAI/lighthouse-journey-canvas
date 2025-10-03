import type { Meta, StoryObj } from '@storybook/react'
import { Toggle } from '../../src/base/toggle'
import { Bold } from 'lucide-react'

const meta = {
  title: 'Base/Toggle',
  component: Toggle,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Toggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Toggle aria-label="Toggle bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
}

export const WithText: Story = {
  render: () => <Toggle aria-label="Toggle italic">Italic</Toggle>,
}
