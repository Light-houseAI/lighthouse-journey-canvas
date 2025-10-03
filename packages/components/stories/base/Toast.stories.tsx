import type { Meta, StoryObj } from '@storybook/react'
import { Toast, ToastAction, ToastDescription, ToastTitle } from '../../src/base/toast'

const meta = {
  title: 'Base/Toast',
  component: Toast,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Toast>
      <div className="grid gap-1">
        <ToastTitle>Scheduled: Catch up</ToastTitle>
        <ToastDescription>Friday, February 10, 2023 at 5:57 PM</ToastDescription>
      </div>
      <ToastAction altText="Close">Close</ToastAction>
    </Toast>
  ),
}
