import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ConfirmDialog } from '../../src/overlays/confirm-dialog'
import { Button } from '../../src/base/button'

const meta = {
  title: 'Overlays/ConfirmDialog',
  component: ConfirmDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const DeleteConfirmation: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)} variant="destructive">
          Delete Item
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Delete Item"
          description="Are you sure you want to delete this item? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            console.log('Item deleted')
          }}
        />
      </>
    )
  },
}

export const DefaultConfirmation: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          Confirm Action
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Confirm Action"
          description="Are you sure you want to proceed with this action?"
          confirmText="Continue"
          onConfirm={async () => {
            await new Promise((resolve) => setTimeout(resolve, 500))
            console.log('Action confirmed')
          }}
        />
      </>
    )
  },
}

export const WithLoading: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)} variant="destructive">
          Delete with Delay
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Delete Account"
          description="This will permanently delete your account and all associated data. This process may take a few moments."
          confirmText="Delete Account"
          isDestructive
          onConfirm={async () => {
            await new Promise((resolve) => setTimeout(resolve, 3000))
            console.log('Account deleted')
          }}
        />
      </>
    )
  },
}
