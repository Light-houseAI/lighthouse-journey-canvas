import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowLeft, MessageCircle, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
    name: "Sarah Chen",
    gradYear: "2023",
    currentRole: "Product Engineer",
    company: "Ring",
    location: "Seattle, WA",
    interviewRole: "Staff Data Scientist",
    interviewCompany: "Capital One",
    interviewYear: "2024",
    result: "Offer",
    questionsAsked: [
      "Walk me through a project where you influenced cross-functional teams",
      "Describe a time when you had to defend your analysis"
    ],
    emphasized: [
      "Highlighted collaboration with infra teams",
      "Focused on user empathy during analytics deep dives"
    ]
  },
  {
    id: "2",
    name: "Marcus Rodriguez",
    gradYear: "2022",
    currentRole: "Senior Software Engineer",
    company: "Meta",
    location: "Menlo Park, CA",
    interviewRole: "Staff Software Engineer",
    interviewCompany: "Stripe",
    interviewYear: "2024",
    result: "Final Round",
    questionsAsked: [
      "Tell me about a time you had to make a difficult technical decision",
      "Describe how you handled conflicting priorities"
    ],
    emphasized: [
      "Emphasized system design thinking",
      "Discussed mentoring junior engineers"
    ]
  },
  {
    id: "3",
    name: "Priya Patel",
    gradYear: "2021",
    currentRole: "Lead Product Manager",
    company: "Airbnb",
    location: "San Francisco, CA",
    interviewRole: "Senior Product Manager",
    interviewCompany: "Uber",
    interviewYear: "2023",
    result: "Rejected",
    questionsAsked: [
      "How do you prioritize features when resources are limited?",
      "Walk me through a product failure and your learnings"
    ],
    emphasized: [
      "Focused on data-driven decision making",
      "Highlighted cross-functional leadership experience"
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

const PersonCard = ({ person }: { person: PersonData }) => {
  return (
    <Card className="w-[380px] h-[600px] flex flex-col">
      <CardContent className="p-6 flex flex-col h-full">
        {/* Avatar + Name + Grad Year */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={person.avatar} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {person.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{person.name}</h3>
              <Badge variant="outline" className="text-xs">
                Class of {person.gradYear}
              </Badge>
            </div>
          </div>
        </div>

        {/* Current Role + Location */}
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground">
            {person.currentRole} at {person.company}
          </p>
          <p className="text-sm text-muted-foreground">{person.location}</p>
        </div>

        {/* Interview Info */}
        <div className="mb-4">
          <p className="text-sm text-foreground mb-2">
            <span className="font-medium">Interviewed for:</span> {person.interviewRole}, {person.interviewCompany} — ({person.interviewYear})
          </p>
          <Badge variant={getResultBadgeVariant(person.result)} className="text-xs">
            {person.result}
          </Badge>
        </div>

        {/* Questions Asked */}
        <div className="mb-4 flex-1">
          <h4 className="font-medium text-sm text-foreground mb-2">Questions Asked</h4>
          <div className="space-y-2">
            {person.questionsAsked.map((question, index) => (
              <p key={index} className="text-sm text-muted-foreground italic">
                "{question}"
              </p>
            ))}
          </div>
        </div>

        {/* What They Emphasized */}
        <div className="mb-6 flex-1">
          <h4 className="font-medium text-sm text-foreground mb-2">What They Emphasized</h4>
          <div className="space-y-1">
            {person.emphasized.map((point, index) => (
              <p key={index} className="text-sm text-muted-foreground">
                • {point}
              </p>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <Button size="sm" className="flex-1">
            <MessageCircle className="h-4 w-4 mr-2" />
            Send Message
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Heart className="h-4 w-4 mr-2" />
            Mark Helpful
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const NetworkInsights = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
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
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Network matches found!
          </h2>
          <p className="text-muted-foreground">
            People in your network have gone through behavioral interviews for similar roles.
          </p>
        </div>

        {/* Horizontal Carousel */}
        <div className="relative">
          <Carousel
            opts={{
              align: "start",
              slidesToScroll: 1,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {mockData.map((person) => (
                <CarouselItem key={person.id} className="pl-4 basis-auto">
                  <PersonCard person={person} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-12" />
            <CarouselNext className="hidden md:flex -right-12" />
          </Carousel>
        </div>
      </div>
    </div>
  );
};

export default NetworkInsights;