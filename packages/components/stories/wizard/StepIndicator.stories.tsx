import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { StepIndicator } from '../../src/wizard/step-indicator'
import { Button } from '../../src/base/button'

const meta = {
  title: 'Wizard/StepIndicator',
  component: StepIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof StepIndicator>

export default meta
type Story = StoryObj<typeof meta>

const steps = [
  { id: 'step-1', label: 'Personal Info' },
  { id: 'step-2', label: 'Account Details' },
  { id: 'step-3', label: 'Confirmation' },
]

export const Default: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0)
    return (
      <div className="w-full max-w-2xl space-y-6">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
        <div className="flex gap-2">
          <Button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            variant="outline"
          >
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={currentStep === steps.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
    )
  },
}

export const Compact: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(1)
    return (
      <div className="w-full max-w-2xl">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          compact
        />
      </div>
    )
  },
}

export const Vertical: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(1)
    return (
      <div className="w-64">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          orientation="vertical"
        />
      </div>
    )
  },
}

export const VerticalCompact: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0)
    return (
      <div className="w-64">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
          orientation="vertical"
          compact
        />
      </div>
    )
  },
}

export const NonClickable: Story = {
  args: {
    steps,
    currentStep: 1,
    orientation: 'horizontal',
  },
}

export const ManySteps: Story = {
  render: () => {
    const manySteps = [
      { id: '1', label: 'Getting Started' },
      { id: '2', label: 'Basic Info' },
      { id: '3', label: 'Details' },
      { id: '4', label: 'Preferences' },
      { id: '5', label: 'Review' },
      { id: '6', label: 'Confirmation' },
    ]
    const [currentStep, setCurrentStep] = useState(2)
    return (
      <div className="w-full max-w-4xl">
        <StepIndicator
          steps={manySteps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
      </div>
    )
  },
}
