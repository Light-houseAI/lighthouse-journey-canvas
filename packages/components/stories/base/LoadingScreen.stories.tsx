import type { Meta, StoryObj } from '@storybook/react'
import { LoadingScreen } from '../../src/base/loading-screen'

const meta = {
  title: 'Base/LoadingScreen',
  component: LoadingScreen,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
