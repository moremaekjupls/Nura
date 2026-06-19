# CaloTrack Architecture Documentation

## Overview

CaloTrack is a minimalist calorie and macronutrient (БЖУ) tracker built with React and Tailwind CSS. The application is designed with a clean separation of concerns, making it easy to migrate from localStorage to a backend API in the future without changing the rest of the codebase.

## Project Structure

```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── MacroCircle.tsx          # Circular progress indicator for macros
│   │   ├── DailySummary.tsx         # Daily nutrition summary display
│   │   ├── MealEntry.tsx            # Individual meal entry card
│   │   ├── MealList.tsx             # List of meals grouped by type
│   │   ├── AddMealForm.tsx          # Form for adding/editing meals
│   │   ├── DateNavigator.tsx        # Date navigation controls
│   │   └── GoalSettingsDialog.tsx   # Modal for editing daily goals
│   ├── hooks/
│   │   └── useDailyData.ts          # Custom hook for data management
│   ├── lib/
│   │   ├── storageService.ts        # Data persistence layer (localStorage)
│   │   ├── dateUtils.ts             # Date manipulation utilities
│   │   └── utils.ts                 # General utilities
│   ├── types/
│   │   └── index.ts                 # TypeScript type definitions
│   ├── pages/
│   │   ├── Home.tsx                 # Main application page
│   │   └── NotFound.tsx             # 404 page
│   ├── contexts/
│   │   └── ThemeContext.tsx         # Theme management
│   ├── App.tsx                      # Root component and routing
│   ├── main.tsx                     # React entry point
│   └── index.css                    # Global styles and theme
├── public/
│   └── favicon.ico
└── index.html

server/                     # Placeholder (not used in static mode)
shared/                     # Placeholder (not used in static mode)
```

## Core Data Models

All data models are defined in `client/src/types/index.ts`:

### Entry
Represents a single meal entry with nutritional information.

```typescript
interface Entry {
  id: string;                    // Unique identifier (auto-generated)
  date: string;                  // ISO date (YYYY-MM-DD)
  name: string;                  // Meal name
  calories: number;              // Total calories
  protein: number;               // Protein in grams
  fat: number;                   // Fat in grams
  carbs: number;                 // Carbohydrates in grams
  mealType?: MealType;           // breakfast | lunch | dinner | snack
  time?: string;                 // Optional time (HH:MM format)
}
```

### Goal
Represents the user's daily nutrition targets.

```typescript
interface Goal {
  calories: number;              // Daily calorie target
  protein: number;               // Daily protein target (grams)
  fat: number;                   // Daily fat target (grams)
  carbs: number;                 // Daily carbs target (grams)
}
```

### DailySummary
Computed summary of a day's nutrition with totals and remaining amounts.

```typescript
interface DailySummary {
  date: string;
  entries: Entry[];
  totals: { calories, protein, fat, carbs };
  goal: Goal;
  remaining: { calories, protein, fat, carbs };
  isOverGoal: { calories, protein, fat, carbs };
}
```

## Data Layer Architecture

### Storage Service (`client/src/lib/storageService.ts`)

The storage service is the **single source of truth** for all data operations. It provides a clean interface that abstracts the underlying storage mechanism (currently localStorage, but easily swappable for API calls).

**Key Methods:**

- `getEntries(date: string): Entry[]` - Fetch all entries for a specific date
- `addEntry(entry: Omit<Entry, 'id'>): Entry` - Add a new meal entry
- `updateEntry(id: string, updates: Partial<Entry>): Entry | null` - Update an existing entry
- `deleteEntry(id: string): boolean` - Delete an entry
- `getGoal(): Goal` - Fetch current daily goals
- `setGoal(goal: Goal): Goal` - Update daily goals
- `getDailySummary(date: string): DailySummary` - Get complete daily summary with computed totals
- `deleteEntriesForDate(date: string): number` - Delete all entries for a date (testing)
- `exportAllData()` - Export all data for backup
- `clearAllData()` - Clear all data (testing)

**Current Implementation:** localStorage with keys `calotrack_entries` and `calotrack_goal`

**Default Goal:** 2000 calories, 150g protein, 65g fat, 250g carbs

## State Management

### useDailyData Hook (`client/src/hooks/useDailyData.ts`)

This custom hook manages all data operations for a specific date. It wraps the storage service and provides React state management.

**Provided Methods:**

- `summary: DailySummary | null` - Current day's summary
- `loading: boolean` - Loading state
- `addEntry(entry)` - Add a meal
- `updateEntry(id, updates)` - Update a meal
- `deleteEntry(id)` - Delete a meal
- `updateGoal(goal)` - Update daily goals
- `refresh()` - Manually refresh data

**Usage in Components:**
```typescript
const { summary, loading, addEntry, updateEntry, deleteEntry, updateGoal } = 
  useDailyData(currentDate);
```

## Component Hierarchy

```
App
└── Home (main page)
    ├── Header
    │   ├── Logo
    │   └── Add Meal Button
    ├── DateNavigator
    ├── DailySummary
    │   └── MacroCircle (x4: calories, protein, fat, carbs)
    ├── AddMealForm (conditional)
    ├── Meals Section
    │   └── MealList
    │       └── MealEntry (x N)
    │           ├── Edit Button
    │           └── Delete Button
    └── GoalSettingsDialog
```

## Migration to Backend API

To migrate from localStorage to a backend API, follow these steps:

### Step 1: Update storageService.ts

Replace localStorage calls with fetch() to your API endpoints:

```typescript
// Before (localStorage)
export function getEntries(date: string): Entry[] {
  const entries = JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]');
  return entries.filter(e => e.date === date);
}

// After (API)
export async function getEntries(date: string): Promise<Entry[]> {
  const response = await fetch(`/api/entries?date=${date}`);
  return response.json();
}
```

### Step 2: Update useDailyData Hook

Make the hook async-aware (add loading states for async operations):

```typescript
// The hook already handles loading states, just ensure
// storageService methods return Promises
```

### Step 3: No Changes Needed in Components

All components use the hook interface, which remains unchanged. They don't need to know whether data comes from localStorage or an API.

### Suggested API Endpoints

```
GET    /api/entries?date=YYYY-MM-DD         # Get entries for a date
POST   /api/entries                         # Create new entry
PUT    /api/entries/:id                     # Update entry
DELETE /api/entries/:id                     # Delete entry
GET    /api/goal                            # Get user's daily goal
PUT    /api/goal                            # Update daily goal
GET    /api/summary?date=YYYY-MM-DD         # Get daily summary (optional)
```

## Design System

### Color Palette (Warm Minimalism)

- **Primary (Peachy-Salmon):** `oklch(0.65 0.18 35)` - Main accent color
- **Secondary (Sage Green):** `oklch(0.68 0.12 140)` - Secondary accent
- **Destructive (Warm Coral):** `oklch(0.58 0.2 25)` - Error/delete actions
- **Background:** `oklch(0.98 0.002 70)` - Off-white warm tone
- **Foreground:** `oklch(0.25 0.01 60)` - Warm dark gray

### Typography

- **Display Font:** Poppins (bold, 800 weight) - Headers and large metrics
- **Body Font:** Inter (regular, 400-600 weight) - Body text and descriptions

### Spacing

Uses Tailwind's default spacing scale (4px base unit). Key breakpoints:
- Mobile: 375px
- Tablet: 640px (sm)
- Desktop: 1024px (lg)

### Animations

- **Fade-in-up:** 0.3s ease-out - Component entrance
- **Scale-in:** 0.2s ease-out - Form entrance
- **Button press:** 0.1s scale(0.97) - Interactive feedback
- **Progress circles:** 0.7s ease-out - Smooth fill animation

## Key Features

### 1. Daily Summary
- Displays current day's totals vs. goals
- Circular progress indicators for each macro
- Color-coded when over goal (red)
- Quick access to goal settings

### 2. Meal Management
- Add meals with name, calories, and macros
- Categorize by meal type (breakfast, lunch, dinner, snack)
- Optional time tracking
- Edit and delete existing meals
- Meals grouped by type in the list

### 3. Date Navigation
- Navigate between days with prev/next buttons
- Quick "today" button
- Shows current date with day of week
- Highlights today's date

### 4. Goal Settings
- Modal dialog for updating daily targets
- Applies to all days
- Persisted in localStorage/API

### 5. Mobile-First Design
- Responsive grid layout (2 columns on mobile, 4 on desktop)
- Floating action button on mobile
- Touch-friendly button sizes (44px minimum)
- Optimized form inputs for mobile keyboards

## Testing Utilities

### storageService.ts provides:

- `exportAllData()` - Export all data as JSON for debugging
- `clearAllData()` - Reset all data for testing
- `deleteEntriesForDate(date)` - Clear a specific day for testing

## Performance Considerations

1. **Memoization:** Components use React.memo where appropriate
2. **Date Calculations:** Cached in dateUtils functions
3. **localStorage:** Data is parsed/stringified only when needed
4. **Animations:** Use CSS transitions (GPU-accelerated) for smooth 60fps
5. **Responsive Images:** No images in current MVP, ready for future optimization

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus rings on all interactive elements
- Color contrast meets WCAG AA standards
- Respects `prefers-reduced-motion` media query

## Future Enhancements

1. **Backend Integration** - Follow migration guide above
2. **Database Persistence** - Replace localStorage with API calls
3. **User Authentication** - Add login/signup
4. **Food Database** - Integrate with nutrition APIs (USDA, Nutritionix)
5. **Meal Templates** - Save and reuse common meals
6. **Export/Reports** - CSV export, weekly/monthly summaries
7. **Notifications** - Reminders to log meals
8. **Dark Mode** - Already supported in theme system
9. **Multi-language** - i18n support structure ready
10. **Offline Support** - Service workers for PWA functionality

## Development Workflow

### Running Locally

```bash
cd /home/ubuntu/calorie-tracker
pnpm install
pnpm dev
```

### Building for Production

```bash
pnpm build
pnpm start
```

### Type Checking

```bash
pnpm check
```

### Code Formatting

```bash
pnpm format
```

## Dependencies

- **React 19:** UI framework
- **Tailwind CSS 4:** Styling
- **Shadcn/ui:** Pre-built components
- **Lucide React:** Icons
- **Wouter:** Client-side routing
- **Sonner:** Toast notifications
- **React Hook Form:** Form state management
- **Zod:** Schema validation

## Notes

- The application is currently a static frontend (no backend server)
- All data is stored in browser's localStorage
- Data persists across browser sessions
- Each browser/device has its own data (no cloud sync)
- Ready to upgrade to full-stack with `webdev_add_feature` if needed
