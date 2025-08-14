# Centralized Icon System Usage

This project uses a centralized icon system to maintain consistency across all node type icons.

## 📍 Single Source of Truth

All node icons are defined in: `client/src/components/icons/NodeIcons.tsx`

```typescript
export const NODE_ICONS: Record<string, LucideIcon> = {
  education: GraduationCap,
  job: Building2,
  careerTransition: TrendingUp,
  project: Rocket,
  event: Calendar,
  action: Zap,
} as const;
```

## 🎯 Usage Patterns

### 1. Using the NodeIcon Component (Recommended)
```tsx
import { NodeIcon } from '@/components/icons/NodeIcons';

// Simple usage
<NodeIcon type="education" size={24} className="text-emerald-600" />

// In components
const MyComponent = ({ nodeType }) => (
  <div>
    <NodeIcon type={nodeType} size={32} className="text-white" />
  </div>
);
```

### 2. Using the Icon Mapping Directly
```tsx
import { NODE_ICONS } from '@/components/icons/NodeIcons';

// Get the Lucide component directly
const EducationIconComponent = NODE_ICONS.education;

// Use in JSX
<EducationIconComponent size={24} className="text-emerald-600" />
```

### 3. Using the Utility Function
```tsx
import { getNodeIcon } from '@/components/icons/NodeIcons';

const MyComponent = ({ nodeType }) => {
  const IconComponent = getNodeIcon(nodeType);
  
  if (!IconComponent) return null;
  
  return <IconComponent size={20} className="text-gray-600" />;
};
```

## ✅ Benefits

1. **Consistency**: Same icon used everywhere for each node type
2. **Single Update Point**: Change icon in one place, updates everywhere
3. **Type Safety**: TypeScript ensures valid node types
4. **Performance**: No duplicate imports across components
5. **Maintainability**: Easy to add new node types or change existing icons

## 🔄 Adding New Node Types

1. Add the icon to `NODE_ICONS` mapping
2. Update the TypeScript types
3. All components automatically support the new type!

```typescript
// Add new icon
export const NODE_ICONS = {
  // existing...
  certification: Award, // New icon
} as const;
```