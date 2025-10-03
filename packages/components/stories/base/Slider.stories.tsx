import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from '../../src/base/slider'

const meta = {
  title: 'Base/Slider',
  component: Slider,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Slider defaultValue={[50]} max={100} step={1} className="w-[400px]" />,
}

export const Range: Story = {
  render: () => <Slider defaultValue={[25, 75]} max={100} step={1} className="w-[400px]" />,
}
