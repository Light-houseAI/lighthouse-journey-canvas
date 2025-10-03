import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SlideOver } from '../../src/panels/slide-over'
import { Button } from '../../src/base/button'
import { Label } from '../../src/base/label'
import { Input } from '../../src/base/input'
import { Textarea } from '../../src/base/textarea'

const meta = {
  title: 'Panels/SlideOver',
  component: SlideOver,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
  },
} satisfies Meta<typeof SlideOver>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open SlideOver</Button>
        <SlideOver
          open={open}
          onClose={() => setOpen(false)}
          title="Edit Profile"
          description="Make changes to your profile here"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Enter your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" placeholder="Tell us about yourself" />
            </div>
          </div>
        </SlideOver>
      </>
    )
  },
}

export const WithFooter: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open with Footer</Button>
        <SlideOver
          open={open}
          onClose={() => setOpen(false)}
          title="Create New Item"
          description="Add a new item to your collection"
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Enter title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Enter description" />
            </div>
          </div>
        </SlideOver>
      </>
    )
  },
}

export const LeftSide: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open from Left</Button>
        <SlideOver
          open={open}
          onClose={() => setOpen(false)}
          side="left"
          title="Navigation"
          description="Quick access to your pages"
        >
          <nav className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
            <Button variant="ghost" className="w-full justify-start">Projects</Button>
            <Button variant="ghost" className="w-full justify-start">Settings</Button>
          </nav>
        </SlideOver>
      </>
    )
  },
}

export const SmallSize: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Small</Button>
        <SlideOver
          open={open}
          onClose={() => setOpen(false)}
          size="sm"
          title="Quick Actions"
        >
          <div className="space-y-2">
            <Button variant="outline" className="w-full">Action 1</Button>
            <Button variant="outline" className="w-full">Action 2</Button>
            <Button variant="outline" className="w-full">Action 3</Button>
          </div>
        </SlideOver>
      </>
    )
  },
}

export const ExtraLarge: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Extra Large</Button>
        <SlideOver
          open={open}
          onClose={() => setOpen(false)}
          size="xl"
          title="Detailed View"
          description="View all details and make comprehensive edits"
        >
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Personal Information</h3>
              <div className="space-y-2">
                <Label htmlFor="fullname">Full Name</Label>
                <Input id="fullname" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Additional Details</h3>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={5} />
              </div>
            </div>
          </div>
        </SlideOver>
      </>
    )
  },
}

export const WithoutCloseButton: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open (No Close Button)</Button>
        <SlideOver
          open={open}
          onClose={() => setOpen(false)}
          title="Confirmation Required"
          description="You must confirm or cancel"
          withCloseButton={false}
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          }
        >
          <p>Are you sure you want to proceed with this action?</p>
        </SlideOver>
      </>
    )
  },
}
