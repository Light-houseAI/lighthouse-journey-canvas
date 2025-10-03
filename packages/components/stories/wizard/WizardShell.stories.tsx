import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { WizardShell } from '../../src/wizard/wizard-shell'
import { Label } from '../../src/base/label'
import { Input } from '../../src/base/input'
import { Textarea } from '../../src/base/textarea'
import { RadioGroup, RadioGroupItem } from '../../src/base/radio-group'

const meta = {
  title: 'Wizard/WizardShell',
  component: WizardShell,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WizardShell>

export default meta
type Story = StoryObj<typeof meta>

const steps = [
  { id: 'step-1', label: 'Personal Info' },
  { id: 'step-2', label: 'Account Details' },
  { id: 'step-3', label: 'Preferences' },
  { id: 'step-4', label: 'Review' },
]

export const Default: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0)
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      username: '',
      password: '',
      notifications: 'email',
      newsletter: 'yes',
    })

    const renderStepContent = () => {
      switch (currentStep) {
        case 0:
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Personal Information</h2>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                />
              </div>
            </div>
          )
        case 1:
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Account Details</h2>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Choose a username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create a password"
                />
              </div>
            </div>
          )
        case 2:
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Preferences</h2>
              <div className="space-y-3">
                <Label>Notification Preference</Label>
                <RadioGroup
                  value={formData.notifications}
                  onValueChange={(value) => setFormData({ ...formData, notifications: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="email" id="email-notif" />
                    <Label htmlFor="email-notif">Email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="sms-notif" />
                    <Label htmlFor="sms-notif">SMS</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both-notif" />
                    <Label htmlFor="both-notif">Both</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Subscribe to Newsletter?</Label>
                <RadioGroup
                  value={formData.newsletter}
                  onValueChange={(value) => setFormData({ ...formData, newsletter: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes-newsletter" />
                    <Label htmlFor="yes-newsletter">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no-newsletter" />
                    <Label htmlFor="no-newsletter">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )
        case 3:
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Review Your Information</h2>
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="font-semibold">Personal Info</h3>
                  <p className="text-sm text-muted-foreground">Name: {formData.name || 'Not provided'}</p>
                  <p className="text-sm text-muted-foreground">Email: {formData.email || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Account Details</h3>
                  <p className="text-sm text-muted-foreground">Username: {formData.username || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Preferences</h3>
                  <p className="text-sm text-muted-foreground">Notifications: {formData.notifications}</p>
                  <p className="text-sm text-muted-foreground">Newsletter: {formData.newsletter}</p>
                </div>
              </div>
            </div>
          )
        default:
          return null
      }
    }

    return (
      <div className="p-8">
        <WizardShell
          currentStep={currentStep}
          steps={steps}
          onStepChange={setCurrentStep}
          content={renderStepContent()}
          onSubmit={() => {
            console.log('Form submitted:', formData)
            alert('Form submitted! Check console for data.')
          }}
        />
      </div>
    )
  },
}

export const SimpleWizard: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0)
    const simpleSteps = [
      { id: '1', label: 'Start' },
      { id: '2', label: 'Middle' },
      { id: '3', label: 'End' },
    ]

    const renderContent = () => {
      switch (currentStep) {
        case 0:
          return <div className="text-center py-8"><h2 className="text-2xl">Welcome to the Wizard!</h2></div>
        case 1:
          return <div className="text-center py-8"><h2 className="text-2xl">Middle Step</h2></div>
        case 2:
          return <div className="text-center py-8"><h2 className="text-2xl">You're Done!</h2></div>
        default:
          return null
      }
    }

    return (
      <div className="p-8">
        <WizardShell
          currentStep={currentStep}
          steps={simpleSteps}
          onStepChange={setCurrentStep}
          content={renderContent()}
          onSubmit={() => console.log('Completed!')}
        />
      </div>
    )
  },
}

export const CustomNavigation: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0)

    return (
      <div className="p-8">
        <WizardShell
          currentStep={currentStep}
          steps={steps}
          onStepChange={setCurrentStep}
          content={
            <div className="text-center py-8">
              <h2 className="text-2xl">Step {currentStep + 1} Content</h2>
            </div>
          }
          backButtonText="Previous"
          nextButtonText="Continue"
          submitButtonText="Finish"
          onSubmit={() => alert('Wizard completed!')}
        />
      </div>
    )
  },
}
