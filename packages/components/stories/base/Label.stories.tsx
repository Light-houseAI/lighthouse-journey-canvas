import type { Meta, StoryObj } from '@storybook/react'
import { Label } from '../../src/base/label'
import { Input } from '../../src/base/input'

const meta = {
  title: 'Base/Label',
  component: Label,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Label Text',
  },
}

export const WithInput: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="email@example.com" />
    </div>
  ),
}

export const Required: Story = {
  render: () => (
    <Label>
      Username <span className="text-red-500">*</span>
    </Label>
  ),
}
