import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Building, GraduationCap, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  description?: string;
  location?: string;
}

interface Education {
  institution: string;
  degree: string;
  field?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

interface JourneyItem {
  type: 'experience' | 'education';
  data: Experience | Education;
  startYear: number;
  endYear?: number;
}

export default function ProfessionalJourney() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [journeyItems, setJourneyItems] = useState<JourneyItem[]>([]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!profile) return;

    const items: JourneyItem[] = [];

    // Add experiences
    if (profile.filteredData?.experiences) {
      profile.filteredData.experiences.forEach((exp: Experience) => {
        const startYear = new Date(exp.startDate).getFullYear();
        const endYear = exp.endDate ? new Date(exp.endDate).getFullYear() : undefined;
        
        items.push({
          type: 'experience',
          data: exp,
          startYear,
          endYear,
        });
      });
    }

    // Add education
    if (profile.filteredData?.education) {
      profile.filteredData.education.forEach((edu: Education) => {
        const startYear = new Date(edu.startDate).getFullYear();
        const endYear = edu.endDate ? new Date(edu.endDate).getFullYear() : undefined;
        
        items.push({
          type: 'education',
          data: edu,
          startYear,
          endYear,
        });
      });
    }

    // Sort by start year (most recent first)
    items.sort((a, b) => (b.endYear || b.startYear) - (a.endYear || a.startYear));
    setJourneyItems(items);
  }, [profile]);

  const formatDateRange = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
    };

    return `${formatDate(start)} - ${end ? formatDate(end) : 'Present'}`;
  };

  const getYearRange = () => {
    if (journeyItems.length === 0) return { min: new Date().getFullYear(), max: new Date().getFullYear() };
    
    const years = journeyItems.flatMap(item => [
      item.startYear,
      item.endYear || new Date().getFullYear()
    ]);
    
    return {
      min: Math.min(...years),
      max: Math.max(...years)
    };
  };

  const { min: minYear, max: maxYear } = getYearRange();
  const totalYears = maxYear - minYear + 1;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading your professional journey...</p>
        </div>
      </div>
    );
  }

  if (!profile || journeyItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <User className="h-12 w-12 text-gray-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">No Journey Data</h2>
          <p className="text-gray-600">No professional experience or education data found.</p>
          <Button onClick={() => setLocation("/")}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Your Professional Journey
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Here's your career path and educational background displayed in a timeline format
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-600"></div>

          {/* Timeline items */}
          <div className="space-y-8">
            {journeyItems.map((item, index) => (
              <div key={index} className="relative flex items-start">
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${
                    item.type === 'experience' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                      : 'bg-gradient-to-br from-green-500 to-green-600'
                  }`}>
                    {item.type === 'experience' ? (
                      <Building className="h-6 w-6 text-white" />
                    ) : (
                      <GraduationCap className="h-6 w-6 text-white" />
                    )}
                  </div>
                </div>

                {/* Content card */}
                <div className="ml-8 flex-1">
                  <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-xl">
                            {item.type === 'experience' 
                              ? (item.data as Experience).position
                              : (item.data as Education).degree
                            }
                          </CardTitle>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building className="h-4 w-4" />
                            <span className="font-medium">
                              {item.type === 'experience' 
                                ? (item.data as Experience).company
                                : (item.data as Education).institution
                              }
                            </span>
                          </div>
                          {item.type === 'education' && (item.data as Education).field && (
                            <div className="text-sm text-gray-500">
                              Field of Study: {(item.data as Education).field}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-4">
                          {item.type === 'experience' ? 'Work' : 'Education'}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Date and location */}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatDateRange(
                              item.data.startDate, 
                              item.data.endDate
                            )}
                          </span>
                        </div>
                        {item.data.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{item.data.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      {item.data.description && (
                        <>
                          <Separator />
                          <div className="text-sm text-gray-700 leading-relaxed">
                            {item.data.description.split('\n').map((line, i) => (
                              <p key={i} className={i > 0 ? 'mt-2' : ''}>
                                {line}
                              </p>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Ready to continue your journey?
            </h3>
            <p className="text-gray-600">
              Your professional profile has been saved and is ready to use.
            </p>
            <Button 
              onClick={() => setLocation("/")}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              Complete Setup <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}