import type { Meta, StoryObj } from '@storybook/react'
import { Progress } from '../../src/base/progress'

const meta = {
  title: 'Base/Progress',
  component: Progress,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Progress value={33} className="w-[400px]" />,
}

export const HalfWay: Story = {
  render: () => <Progress value={50} className="w-[400px]" />,
}

export const Complete: Story = {
  render: () => <Progress value={100} className="w-[400px]" />,
}
