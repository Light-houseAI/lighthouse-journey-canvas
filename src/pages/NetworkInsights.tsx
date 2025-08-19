import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MessageCircle, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PersonData {
  id: string;
  name: string;
  gradYear: string;
  avatar?: string;
  currentRole: string;
  company: string;
  location: string;
  interviewRole: string;
  interviewCompany: string;
  interviewYear: string;
  result: "Offer" | "Rejected" | "Final Round";
  questionsAsked: string[];
  emphasized: string[];
}

const mockData: PersonData[] = [
  {
    id: "1",
    name: "Anika Patel",
    gradYear: "2020",
    currentRole: "Staff Data Scientist",
    company: "LendingClub",
    location: "Seattle, WA",
    interviewRole: "Capital One – Lending Analytics",
    interviewCompany: "Capital One",
    interviewYear: "2024",
    result: "Offer",
    questionsAsked: [
      "Define drop-off for our app—where do partially saved apps land?",
      "No replays allowed. What's your privacy-safe way to diagnose friction?",
      "If KYC can't be randomized, how do you estimate causal impact?"
    ],
    emphasized: [
      "1-pager Analytics PRD (stages, events, owners, redaction rules)",
      "Screenshot of guardrail metrics (approval-rate parity, latency SLO)",
      "Bring a crisp taxonomy diagram + 2 guardrails you'd track from day 1"
    ]
  },
  {
    id: "2",
    name: "Miguel Santos",
    gradYear: "2018",
    currentRole: "Principal Data Analyst",
    company: "Upstart",
    location: "San Francisco, CA",
    interviewRole: "Chime – Lending & Risk Analytics",
    interviewCompany: "Chime",
    interviewYear: "2024",
    result: "Final Round",
    questionsAsked: [
      "You see a spike at document upload with no PII. What 3 signals do you add first?",
      "A vendor times out intermittently—walk us through your triage and what you'd ship in week 1.",
      "How do you show directional lift when samples are small?"
    ],
    emphasized: [
      "5-stage funnel Looker view, one definition of 'drop-off'",
      "Tiny triage checklist (when to file vendor ticket vs. product change)",
      "Have a week-1 plan: add 3 signals, one alert, one pilot (copy or save-and-finish)"
    ]
  },
  {
    id: "3",
    name: "Devon Chen",
    gradYear: "2017",
    currentRole: "Senior Data Scientist",
    company: "Affirm",
    location: "New York, NY",
    interviewRole: "LendingClub – Growth & Risk DS",
    interviewCompany: "LendingClub",
    interviewYear: "2025",
    result: "Offer",
    questionsAsked: [
      "What guardrails sit next to completion rate for this funnel?",
      "Randomization isn't ready—outline an offline evaluation using historical data.",
      "How would you measure adoption of your diagnostic tool?"
    ],
    emphasized: [
      "Simple ROI sketch (eng weeks → projected lift → business proxy)",
      "Usage analytics on the dashboard (weekly active PMs, top views)",
      "Arrive with 1 north star + 2 guardrails, and a 3-line adoption plan (ritual, owner, alert)"
    ]
  }
];

const getResultBadgeVariant = (result: string) => {
  switch (result) {
    case "Offer":
      return "default";
    case "Rejected":
      return "destructive";
    case "Final Round":
      return "secondary";
    default:
      return "outline";
  }
};

const PersonCard = ({ person, isActive = false }: { person: PersonData; isActive?: boolean }) => {
  return (
    <Card className={`w-[600px] h-[700px] flex flex-col shadow-lg ${isActive ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}>
      <CardContent className="p-6 flex flex-col h-full">
        {/* Avatar + Name + Grad Year */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={person.avatar} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {person.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">{person.name}</h3>
              <Badge variant="outline" className="text-xs border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300">
                Class of {person.gradYear}
              </Badge>
            </div>
          </div>
        </div>

        {/* Current Role + Location */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {person.currentRole} at {person.company}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{person.location}</p>
        </div>

        {/* Interview Info */}
        <div className="mb-4">
          <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
            <span className="font-medium">Interviewed for:</span> {person.interviewRole} ({person.interviewYear})
          </p>
          <Badge 
            variant={getResultBadgeVariant(person.result)} 
            className={`text-xs ${person.result === 'Offer' ? 'bg-green-100 text-green-800 dark:bg-green-100/20 dark:text-green-400' : ''}`}
          >
            {person.result === 'Offer' ? '✅ Received offer' : person.result === 'Final Round' ? '🟡 Reached final round' : person.result}
          </Badge>
        </div>

        {/* What interviewers probed */}
        <div className="mb-3">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">What interviewers probed</h4>
          <div className="space-y-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">• Canonical event taxonomy for lending funnels; handling re-opens/duplicates.</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">• Privacy-first measurement (no PII/session replays), Fair Lending guardrails.</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">• Power/MDE and non-randomized evaluation (holdouts, diff-in-diff).</p>
          </div>
        </div>

        {/* Exact-style questions she logged */}
        <div className="mb-3">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Exact-style questions she logged</h4>
          <div className="space-y-1">
            {person.questionsAsked.map((question, index) => (
              <p key={index} className="text-xs text-gray-600 dark:text-gray-400 italic">
                • "{question}"
              </p>
            ))}
          </div>
        </div>

        {/* Artifacts that were effective */}
        <div className="mb-3">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Artifacts that were effective</h4>
          <div className="space-y-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">• 1-pager Analytics PRD (stages, events, owners, redaction rules).</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">• Screenshot of guardrail metrics (approval-rate parity, latency SLO).</p>
          </div>
        </div>

        {/* Pitfalls they flagged */}
        <div className="mb-3">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Pitfalls they flagged</h4>
          <div className="space-y-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">• Overly broad 'conversion up' claims without stage-level lineage.</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">• Ignoring adverse action implications in the measurement plan.</p>
          </div>
        </div>

        {/* Prep tips for you */}
        <div className="mb-6">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Prep tips for you</h4>
          <div className="space-y-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">• Bring a crisp taxonomy diagram + 2 guardrails you'd track from day 1.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <Button variant="outline" size="sm" className="flex-1 bg-purple-50 border-purple-500 text-purple-600 hover:bg-purple-100 dark:bg-purple-100/10 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-100/20 rounded-lg">
            <Heart className="h-4 w-4 mr-2" />
            Mark Helpful
          </Button>
          <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-white">
            <MessageCircle className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const NetworkInsights = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleBack = () => {
    navigate(-1);
  };

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % mockData.length);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + mockData.length) % mockData.length);
  };

  const getCardPosition = (index: number) => {
    const diff = index - currentIndex;
    if (diff === 0) return 'current';
    if (diff === 1 || diff === -(mockData.length - 1)) return 'next';
    if (diff === -1 || diff === mockData.length - 1) return 'prev';
    return 'hidden';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Network and AI insights</h1>
            <div className="w-16" /> {/* Spacer for center alignment */}
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Network matches found!
          </h2>
          <p className="text-muted-foreground">
            People in your network have gone through behavioral interviews for similar roles.
          </p>
        </div>

        {/* Card Stack */}
        <div className="relative flex justify-center items-center min-h-[750px]">
          <div className="relative w-[660px] h-[750px]">
            <AnimatePresence mode="popLayout">
              {mockData.map((person, index) => {
                const position = getCardPosition(index);
                if (position === 'hidden') return null;

                return (
                  <motion.div
                    key={person.id}
                    layout
                    initial={{ 
                      x: position === 'next' ? 300 : position === 'prev' ? -300 : 0,
                      scale: position === 'current' ? 1 : 0.95,
                      opacity: position === 'current' ? 1 : 0.7,
                      filter: position === 'current' ? 'blur(0px)' : 'blur(1px)',
                      zIndex: position === 'current' ? 30 : position === 'next' ? 20 : 10
                    }}
                    animate={{ 
                      x: position === 'next' ? 50 : position === 'prev' ? -50 : 0,
                      scale: position === 'current' ? 1 : 0.92,
                      opacity: position === 'current' ? 1 : 0.6,
                      filter: position === 'current' ? 'blur(0px)' : 'blur(2px)',
                      zIndex: position === 'current' ? 30 : position === 'next' ? 20 : 10
                    }}
                    exit={{ 
                      x: position === 'next' ? 300 : -300,
                      scale: 0.9,
                      opacity: 0
                    }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 260, 
                      damping: 20,
                      duration: 0.4
                    }}
                    className="absolute inset-0 flex justify-center items-center"
                    style={{
                      zIndex: position === 'current' ? 30 : position === 'next' ? 20 : 10
                    }}
                  >
                    <PersonCard person={person} isActive={position === 'current'} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="icon"
            onClick={prevCard}
            className="absolute left-4 md:left-8 lg:left-16 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full border-2 border-border bg-background/90 hover:bg-background hover:scale-110 hover:shadow-lg transition-all duration-200 z-40"
          >
            <ChevronLeft className="h-6 w-6 text-foreground" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={nextCard}
            className="absolute right-4 md:right-8 lg:right-16 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full border-2 border-border bg-background/90 hover:bg-background hover:scale-110 hover:shadow-lg transition-all duration-200 z-40"
          >
            <ChevronRight className="h-6 w-6 text-foreground" />
          </Button>

          {/* Card Counter */}
          <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 flex gap-2 z-40">
            {mockData.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentIndex 
                    ? 'bg-primary w-6' 
                    : 'bg-muted hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkInsights;