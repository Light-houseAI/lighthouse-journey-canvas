import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react'
import * as projectAnnotations from './preview'

// Apply Storybook annotations (decorators, parameters) to Vitest
const project = setProjectAnnotations([projectAnnotations])

beforeAll(project.beforeAll)
