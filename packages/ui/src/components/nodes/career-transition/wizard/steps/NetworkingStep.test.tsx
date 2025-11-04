import { NetworkingType } from '@journey/schema';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WizardData } from '../CareerUpdateWizard';
import { NetworkingStep } from './NetworkingStep';
import type { NetworkingActivity } from './types';

describe('NetworkingStep', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    data: { networking: true } as WizardData,
    onNext: mockOnNext,
    onBack: mockOnBack,
    onCancel: mockOnCancel,
    currentStep: 2,
    totalSteps: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Type Selection Screen', () => {
    it('should render type selection screen initially', () => {
      render(<NetworkingStep {...defaultProps} />);

      expect(
        screen.getByText(/what type of networking did you do/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/select the type of networking activity/i)
      ).toBeInTheDocument();
    });

    it('should display all networking type options', () => {
      render(<NetworkingStep {...defaultProps} />);

      expect(screen.getByText(NetworkingType.ColdOutreach)).toBeInTheDocument();
      expect(
        screen.getByText(NetworkingType.ReconnectedWithSomeone)
      ).toBeInTheDocument();
      expect(
        screen.getByText(NetworkingType.AttendedNetworkingEvent)
      ).toBeInTheDocument();
      expect(
        screen.getByText(NetworkingType.InformationalInterview)
      ).toBeInTheDocument();
    });

    it('should enable Continue button when at least one type is selected', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();

      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.ColdOutreach,
      });
      await user.click(checkbox);

      expect(continueButton).not.toBeDisabled();
    });

    it('should allow multiple type selections', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const checkbox1 = screen.getByRole('checkbox', {
        name: NetworkingType.ColdOutreach,
      });
      const checkbox2 = screen.getByRole('checkbox', {
        name: NetworkingType.ReconnectedWithSomeone,
      });

      await user.click(checkbox1);
      await user.click(checkbox2);

      expect(checkbox1).toBeChecked();
      expect(checkbox2).toBeChecked();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const cancelButton = screen.getByRole('button', {
        name: /cancel update/i,
      });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalledOnce();
    });

    it('should transition to form screen after selecting type and clicking Continue', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.ReconnectedWithSomeone,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByText(NetworkingType.ReconnectedWithSomeone)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Cold Outreach Form', () => {
    const setupColdOutreachForm = async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.ColdOutreach,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      return user;
    };

    it('should render cold outreach form fields', async () => {
      await setupColdOutreachForm();

      await waitFor(() => {
        expect(
          screen.getByText(/whom did you reach out to/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/which channels did you do cold outreach on/i)
        ).toBeInTheDocument();
        expect(
          screen.getByLabelText(/example on how you reached out/i)
        ).toBeInTheDocument();
      });
    });

    it('should display predefined channel options', async () => {
      await setupColdOutreachForm();

      await waitFor(() => {
        expect(screen.getByText('LinkedIn')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(
          screen.getByText('Slack / Discord/ Community platforms')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Alumni or professional groups')
        ).toBeInTheDocument();
        expect(screen.getByText('Other')).toBeInTheDocument();
      });
    });

    it('should enable Complete button when all required fields are filled', async () => {
      const user = await setupColdOutreachForm();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).toBeDisabled();
      });

      // Add whom
      const whomInput = screen.getByPlaceholderText(/enter name or role/i);
      await user.type(whomInput, 'John Doe{Enter}');

      // Select a channel
      const linkedinCheckbox = screen.getByRole('checkbox', {
        name: /linkedin/i,
      });
      await user.click(linkedinCheckbox);

      // Add example
      const exampleTextarea = screen.getByLabelText(
        /example on how you reached out/i
      );
      await user.type(
        exampleTextarea,
        'I sent a connection request with a personalized message.'
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).not.toBeDisabled();
      });
    });

    it('should show Other channel input when Other is selected', async () => {
      const user = await setupColdOutreachForm();

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(/specify other channel/i)
        ).not.toBeInTheDocument();
      });

      const otherCheckbox = screen.getByRole('checkbox', { name: /^other$/i });
      await user.click(otherCheckbox);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/specify other channel/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Reconnected With Someone Form', () => {
    const setupReconnectedForm = async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.ReconnectedWithSomeone,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      return user;
    };

    it('should render reconnected form fields', async () => {
      await setupReconnectedForm();

      await waitFor(() => {
        expect(screen.getByText(/contacts/i)).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText(/add any notes about the reconnection/i)
        ).toBeInTheDocument();
      });
    });

    it('should enable Complete button when contact is added', async () => {
      const user = await setupReconnectedForm();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).toBeDisabled();
      });

      const contactInput = screen.getByPlaceholderText(/enter contact name/i);
      await user.type(contactInput, 'Jane Smith{Enter}');

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).not.toBeDisabled();
      });
    });
  });

  describe('Attended Networking Event Form', () => {
    const setupEventForm = async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.AttendedNetworkingEvent,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      return user;
    };

    it('should render event form fields', async () => {
      await setupEventForm();

      await waitFor(() => {
        expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText(/add details about the event/i)
        ).toBeInTheDocument();
      });
    });

    it('should enable Complete button when event name is entered', async () => {
      const user = await setupEventForm();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).toBeDisabled();
      });

      const eventInput = screen.getByLabelText(/event name/i);
      await user.type(eventInput, 'Tech Conference 2024');

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).not.toBeDisabled();
      });
    });
  });

  describe('Informational Interview Form', () => {
    const setupInterviewForm = async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.InformationalInterview,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      return user;
    };

    it('should render interview form fields', async () => {
      await setupInterviewForm();

      await waitFor(() => {
        expect(screen.getByLabelText(/^contact$/i)).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText(/add details about the interview/i)
        ).toBeInTheDocument();
      });
    });

    it('should enable Complete button when contact is entered', async () => {
      const user = await setupInterviewForm();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).toBeDisabled();
      });

      const contactInput = screen.getByLabelText(/^contact$/i);
      await user.type(contactInput, 'Sarah Johnson');

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /complete/i })
        ).not.toBeDisabled();
      });
    });
  });

  describe('Multi-type Flow', () => {
    it('should show Next button when multiple types are selected', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      // Select two types
      const checkbox1 = screen.getByRole('checkbox', {
        name: NetworkingType.ReconnectedWithSomeone,
      });
      const checkbox2 = screen.getByRole('checkbox', {
        name: NetworkingType.AttendedNetworkingEvent,
      });

      await user.click(checkbox1);
      await user.click(checkbox2);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Fill first form
      await waitFor(() => {
        expect(
          screen.getByText(NetworkingType.ReconnectedWithSomeone)
        ).toBeInTheDocument();
      });

      const contactInput = screen.getByPlaceholderText(/enter contact name/i);
      await user.type(contactInput, 'Jane Smith{Enter}');

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /next/i })
        ).toBeInTheDocument();
      });
    });

    it('should call onNext with all activities when completing multiple types', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      // Select one type for simplicity
      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.AttendedNetworkingEvent,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Fill form
      await waitFor(() => {
        const eventInput = screen.getByLabelText(/event name/i);
        expect(eventInput).toBeInTheDocument();
      });

      const eventInput = screen.getByLabelText(/event name/i);
      await user.type(eventInput, 'Tech Meetup');

      const completeButton = screen.getByRole('button', { name: /complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalledWith(
          expect.objectContaining({
            networkingData: expect.objectContaining({
              activities: expect.arrayContaining([
                expect.objectContaining({
                  networkingType: NetworkingType.AttendedNetworkingEvent,
                  event: 'Tech Meetup',
                }),
              ]),
            }),
          })
        );
      });
    });
  });

  describe('Navigation', () => {
    it('should allow going back to type selection from form', async () => {
      const user = userEvent.setup();
      render(<NetworkingStep {...defaultProps} />);

      // Select type and continue
      const checkbox = screen.getByRole('checkbox', {
        name: NetworkingType.AttendedNetworkingEvent,
      });
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Click back
      await waitFor(() => {
        const backButton = screen.getByRole('button', {
          name: /back to types/i,
        });
        expect(backButton).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to types/i });
      await user.click(backButton);

      // Should be back at type selection
      await waitFor(() => {
        expect(
          screen.getByText(/what type of networking did you do/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Existing Activities', () => {
    it('should display existing activities in the type selection', () => {
      const existingActivity: NetworkingActivity = {
        networkingType: NetworkingType.ColdOutreach,
        whom: ['John Doe'],
        channels: ['LinkedIn'],
        exampleOnHow: 'Sent personalized message',
        timestamp: new Date().toISOString(),
      };

      const propsWithData = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          networkingData: {
            activities: [existingActivity],
          },
        } as WizardData,
      };

      render(<NetworkingStep {...propsWithData} />);

      expect(screen.getByText(/added activities \(1\)/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(NetworkingType.ColdOutreach).length
      ).toBeGreaterThan(0);
    });
  });
});
