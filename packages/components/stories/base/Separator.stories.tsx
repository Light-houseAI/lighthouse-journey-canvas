import type { Meta, StoryObj } from '@storybook/react'
import { Separator } from '../../src/base/separator'

const meta = {
  title: 'Base/Separator',
  component: Separator,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-64">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Radix Primitives</h4>
        <p className="text-sm text-muted-foreground">An open-source UI component library.</p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>Blog</div>
        <Separator orientation="vertical" />
        <div>Docs</div>
        <Separator orientation="vertical" />
        <div>Source</div>
      </div>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-20 items-center">
      <span>Item 1</span>
      <Separator orientation="vertical" className="mx-4" />
      <span>Item 2</span>
      <Separator orientation="vertical" className="mx-4" />
      <span>Item 3</span>
    </div>
  ),
}
