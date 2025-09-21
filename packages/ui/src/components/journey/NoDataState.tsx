import { ArrowRight, Plus } from "lucide-react";
import React from 'react';
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { useTheme } from '@/contexts/ThemeContext';

export const NoDataState: React.FC = () => {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();

  return (
    <div className="h-full flex items-center justify-center p-4 pt-24">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <ArrowRight className="h-8 w-8 text-[#2E2E2E]" />
        </div>
        <h2 className={`text-2xl font-semibold ${theme.primaryText}`}>No Journey Data</h2>
        <p className={theme.secondaryText}>
          Ready to visualize your career journey? Add your professional experience and education to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => setLocation("/extract")}
            className="bg-[#2E2E2E] hover:bg-[#454C52] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Profile Data
          </Button>
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className={`${theme.primaryBorder} border ${theme.secondaryText} hover:${theme.cardBackground}`}
          >
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  );
};
