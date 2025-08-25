import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { JourneyHeader } from "./JourneyHeader";

export const NoDataState: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <JourneyHeader />
      
      <div className="h-full flex items-center justify-center p-4 pt-24">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
            <ArrowRight className="h-8 w-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white">No Journey Data</h2>
          <p className="text-purple-200">
            Ready to visualize your career journey? Add your professional experience and education to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => setLocation("/extract")} 
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Profile Data
            </Button>
            <Button 
              onClick={() => setLocation("/")} 
              variant="outline"
              className="bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white"
            >
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};