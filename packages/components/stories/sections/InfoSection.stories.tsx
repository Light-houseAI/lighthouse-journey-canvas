import type { Meta, StoryObj } from '@storybook/react'
import { Info, AlertCircle, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react'
import { InfoSection } from '../../src/sections/info-section'
import { Button } from '../../src/base/button'

const meta = {
  title: 'Sections/InfoSection',
  component: InfoSection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'danger', 'neutral'],
    },
  },
} satisfies Meta<typeof InfoSection>

export default meta
type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Information',
    description: 'This is an informational message to provide context and helpful details.',
  },
}

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Success',
    description: 'Your changes have been saved successfully.',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Warning',
    description: 'Please review your information before proceeding.',
  },
}

export const Danger: Story = {
  args: {
    variant: 'danger',
    title: 'Error',
    description: 'There was a problem processing your request. Please try again.',
  },
}

export const Neutral: Story = {
  args: {
    variant: 'neutral',
    title: 'Note',
    description: 'This is a neutral message without specific semantic meaning.',
  },
}

export const WithCustomIcon: Story = {
  args: {
    variant: 'info',
    icon: <Lightbulb className="h-5 w-5" />,
    title: 'Pro Tip',
    description: 'You can use keyboard shortcuts to navigate faster.',
  },
}

export const WithActions: Story = {
  args: {
    variant: 'warning',
    title: 'Incomplete Profile',
    description: 'Your profile is missing some required information.',
    actions: (
      <Button size="sm" variant="outline">
        Complete Now
      </Button>
    ),
  },
}

export const WithChildren: Story = {
  render: () => (
    <InfoSection
      variant="info"
      title="Additional Details"
      description="Here are some important points to consider:"
    >
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>First important point</li>
        <li>Second important point</li>
        <li>Third important point</li>
      </ul>
    </InfoSection>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4 max-w-2xl">
      <InfoSection
        variant="info"
        title="Information"
        description="This is an informational message."
      />
      <InfoSection
        variant="success"
        title="Success"
        description="Operation completed successfully."
      />
      <InfoSection
        variant="warning"
        title="Warning"
        description="Please be careful with this action."
      />
      <InfoSection
        variant="danger"
        title="Error"
        description="Something went wrong."
      />
      <InfoSection
        variant="neutral"
        title="Note"
        description="A neutral message."
      />
    </div>
  ),
}

export const WithActionsAndChildren: Story = {
  render: () => (
    <InfoSection
      variant="success"
      title="Profile Complete"
      description="Your profile has been successfully updated with the following changes:"
      actions={
        <Button size="sm">View Profile</Button>
      }
    >
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Profile picture updated</li>
        <li>Bio information added</li>
        <li>Contact details verified</li>
      </ul>
    </InfoSection>
  ),
}

export const ComplexExample: Story = {
  render: () => (
    <div className="space-y-4 max-w-2xl">
      <InfoSection
        variant="info"
        icon={<Info className="h-5 w-5" />}
        title="Getting Started"
        description="Follow these steps to set up your account:"
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Create your profile</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Verify your email</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span>Complete payment setup</span>
          </div>
        </div>
      </InfoSection>
    </div>
  ),
}
