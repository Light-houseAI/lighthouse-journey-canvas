import { useState } from 'react';
import { useToast } from '../../hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

const jobRoles = [
  'Product Manager',
  'Software Engineer',
  'Founder',
  'Designer',
  'Operations',
  'Other'
];

interface WaitlistResponse {
  success: boolean;
  data?: {
    message: string;
    alreadyExists?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface WaitlistFormProps {
  onSignUp?: () => void;
}

const WaitlistForm = ({ onSignUp }: WaitlistFormProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Missing information",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          jobRole: jobRole || null,
        }),
      });

      const result: WaitlistResponse = await response.json();

      setIsSubmitting(false);

      if (!result.success) {
        toast({
          title: "Something went wrong",
          description: result.error?.message || "Please try again later.",
          variant: "destructive"
        });
        return;
      }

      // Handle already on list
      if (result.data?.alreadyExists) {
        toast({
          title: "Already on the list!",
          description: "This email is already registered for early access.",
        });
        setIsSubmitted(true);
        return;
      }

      setIsSubmitted(true);
      toast({
        title: "You're on the list!",
        description: "We'll be in touch soon with early access.",
      });
    } catch (error) {
      setIsSubmitting(false);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-md border border-krama-primary bg-krama-primary/5 p-6 text-center">
        <p className="text-krama-primary font-bold text-lg">YOU'RE ON THE LIST</p>
        <p className="text-krama-text-body text-sm mt-2">We'll reach out soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="YOUR EMAIL"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border border-krama-primary bg-krama-background px-4 py-3 text-krama-primary placeholder:text-krama-text-body/50 focus:outline-none focus:ring-1 focus:ring-krama-primary font-sans"
          disabled={isSubmitting}
        />
        <select
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          className="border border-krama-primary bg-krama-background px-4 py-3 text-krama-primary focus:outline-none focus:ring-1 focus:ring-krama-primary appearance-none cursor-pointer font-sans"
          disabled={isSubmitting}
        >
          <option value="" disabled>YOUR ROLE</option>
          {jobRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="w-full border-2 border-krama-primary text-krama-primary hover:bg-krama-primary hover:text-white transition-colors px-6 py-4 font-medium uppercase tracking-wider text-sm"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Requesting...' : 'Request Early Access'}
      </button>
    </form>
  );
};

export default WaitlistForm;
