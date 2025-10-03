import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { MonthInput } from '../../src/fields/month-input'

const meta = {
  title: 'Fields/MonthInput',
  component: MonthInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MonthInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <div className="w-80">
        <MonthInput
          id="month"
          label="Select Month"
          value={value}
          onChange={setValue}
        />
      </div>
    )
  },
}

export const Required: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <div className="w-80">
        <MonthInput
          id="required-month"
          label="Start Date"
          value={value}
          onChange={setValue}
          required
        />
      </div>
    )
  },
}

export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <div className="w-80">
        <MonthInput
          id="error-month"
          label="End Date"
          value={value}
          onChange={setValue}
          error="This field is required"
          required
        />
      </div>
    )
  },
}

export const WithMinMax: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <div className="w-80">
        <MonthInput
          id="minmax-month"
          label="Select Month (2023-2024 only)"
          value={value}
          onChange={setValue}
          min="2023-01"
          max="2024-12"
        />
      </div>
    )
  },
}

export const PrefilledValue: Story = {
  render: () => {
    const [value, setValue] = useState('2024-03')
    return (
      <div className="w-80">
        <MonthInput
          id="prefilled-month"
          label="Current Month"
          value={value}
          onChange={setValue}
        />
      </div>
    )
  },
}

export const FormExample: Story = {
  render: () => {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    return (
      <div className="w-80 space-y-4">
        <MonthInput
          id="start-date"
          label="Start Date"
          value={startDate}
          onChange={setStartDate}
          required
        />
        <MonthInput
          id="end-date"
          label="End Date"
          value={endDate}
          onChange={setEndDate}
          min={startDate}
        />
      </div>
    )
  },
}
