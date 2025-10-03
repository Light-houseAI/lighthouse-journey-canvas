// Utilities
export { cn } from './lib/utils'

// Base Components (shadcn/ui)
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './base/accordion'
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger } from './base/alert-dialog'
export { Alert, AlertDescription, AlertTitle } from './base/alert'
export { AspectRatio } from './base/aspect-ratio'
export { Avatar, AvatarFallback, AvatarImage } from './base/avatar'
export { Badge, badgeVariants } from './base/badge'
export { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './base/breadcrumb'
export { Button, buttonVariants, type ButtonProps } from './base/button'
export { Calendar } from './base/calendar'
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './base/card'
export { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from './base/carousel'
export { ChatToggle } from './base/chat-toggle'
export { Checkbox } from './base/checkbox'
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from './base/collapsible'
export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from './base/command'
export { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuPortal, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from './base/context-menu'
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './base/dialog'
export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerPortal, DrawerTitle, DrawerTrigger } from './base/drawer'
export { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from './base/dropdown-menu'
export { ExpandChevron } from './base/expand-chevron'
export { FloatingActionButton } from './base/floating-action-button'
export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField } from './base/form'
export { HoverCard, HoverCardContent, HoverCardTrigger } from './base/hover-card'
export { Input } from './base/input'
export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './base/input-otp'
export { Label } from './base/label'
export { LoadingScreen } from './base/loading-screen'
export { Menubar, MenubarCheckboxItem, MenubarContent, MenubarGroup, MenubarItem, MenubarLabel, MenubarMenu, MenubarPortal, MenubarRadioGroup, MenubarRadioItem, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from './base/menubar'
export { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle } from './base/navigation-menu'
export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from './base/pagination'
export { Popover, PopoverContent, PopoverTrigger } from './base/popover'
export { Progress } from './base/progress'
export { PulsatingButton } from './base/pulsating-button'
export { RadioGroup, RadioGroupItem } from './base/radio-group'
export { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './base/resizable'
export { ScrollArea, ScrollBar } from './base/scroll-area'
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from './base/select'
export { Separator } from './base/separator'
export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetOverlay, SheetPortal, SheetTitle, SheetTrigger } from './base/sheet'
export { Skeleton } from './base/skeleton'
export { Slider } from './base/slider'
export { Switch } from './base/switch'
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from './base/table'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './base/tabs'
export { Textarea } from './base/textarea'
export { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './base/toast'
export { Toggle, toggleVariants } from './base/toggle'
export { ToggleGroup, ToggleGroupItem } from './base/toggle-group'
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './base/tooltip'

// Animation Components (MagicUI)
export { AnimatedList } from './animation/animated-list'
export { AnimatedSubscribeButton } from './animation/animated-subscribe-button'
export { BlurFade } from './animation/blur-fade'
export { InteractiveHoverButton } from './animation/interactive-hover-button'
export { MagicCard } from './animation/magic-card'
export { RippleButton } from './animation/ripple-button'
export { ShimmerButton } from './animation/shimmer-button'

// Phase 5: Reusable Component Patterns
// Overlays
export { ConfirmDialog, type ConfirmDialogProps } from './overlays/confirm-dialog'

// Buttons
export { LoadingButton, type LoadingButtonProps } from './buttons/loading-button'

// Avatar
export { InitialsAvatar, getInitials, type InitialsAvatarProps } from './avatar/initials-avatar'

// Misc
export { IconBadge, type IconBadgeProps } from './misc/icon-badge'

// Panels
export { SlideOver, type SlideOverProps } from './panels/slide-over'

// Fields
export { MonthInput, type MonthInputProps } from './fields/month-input'

// Wizard
export { StepIndicator, type Step, type StepIndicatorProps } from './wizard/step-indicator'
export { WizardShell, type WizardShellProps } from './wizard/wizard-shell'

// Sections
export { InfoSection, type InfoSectionProps } from './sections/info-section'

// Tiles
export { OptionTile, type OptionTileProps } from './tiles/option-tile'
export { OptionTileGrid, type OptionTileGridProps } from './tiles/option-tile-grid'
