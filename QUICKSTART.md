# CaloTrack Quick Start Guide

## For Users

### Getting Started

1. **Open the app** - Navigate to the CaloTrack URL in your browser
2. **Set your daily goals** - Click the settings icon (⚙️) in the top-right of the nutrition summary to adjust your calorie and macro targets
3. **Add your first meal** - Click the "Add Meal" button to log what you ate
4. **Fill in the details:**
   - Meal name (e.g., "Grilled chicken with rice")
   - Meal type (breakfast, lunch, dinner, or snack)
   - Time (optional)
   - Calories and macros (protein, fat, carbs)
5. **View your progress** - The circular indicators show how much of each macro you've consumed vs. your goal
6. **Navigate between days** - Use the left/right arrows to view past or future days

### Tips

- **Edit meals** - Click the pencil icon on any meal to make changes
- **Delete meals** - Click the trash icon to remove a meal
- **Return to today** - Click the date in the center to jump back to today
- **Mobile-friendly** - The floating "+" button on mobile makes it easy to add meals on the go
- **Your data is local** - All data is stored in your browser, so it persists between sessions but doesn't sync across devices

## For Developers

### Project Setup

```bash
# Navigate to project
cd /home/ubuntu/calorie-tracker

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open in browser
# http://localhost:3000
```

### Key Files to Know

| File | Purpose |
|------|---------|
| `client/src/lib/storageService.ts` | Data persistence layer (localStorage) |
| `client/src/hooks/useDailyData.ts` | React hook for data management |
| `client/src/types/index.ts` | TypeScript type definitions |
| `client/src/pages/Home.tsx` | Main application page |
| `client/src/components/` | Reusable UI components |
| `client/src/index.css` | Global styles and theme |

### Adding a New Feature

#### Example: Add a "Copy Yesterday" button

1. **Add method to storageService.ts:**
```typescript
export function copyEntriesFromDate(fromDate: string, toDate: string): number {
  const entries = getEntries(fromDate);
  let count = 0;
  entries.forEach(entry => {
    addEntry({ ...entry, date: toDate });
    count++;
  });
  return count;
}
```

2. **Use in Home.tsx:**
```typescript
const handleCopyYesterday = () => {
  const yesterday = addDaysToISO(currentDate, -1);
  const count = copyEntriesFromDate(yesterday, currentDate);
  toast.success(`Copied ${count} meals from yesterday`);
};
```

3. **Add button to UI:**
```tsx
<Button onClick={handleCopyYesterday}>Copy Yesterday</Button>
```

### Modifying the Theme

Edit `client/src/index.css` to change colors:

```css
:root {
  --primary: oklch(0.65 0.18 35);  /* Change primary color */
  --secondary: oklch(0.68 0.12 140);  /* Change secondary color */
  /* ... other colors ... */
}
```

### Migrating to Backend

See `ARCHITECTURE.md` for detailed migration guide. Quick summary:

1. Update `storageService.ts` methods to use `fetch()` instead of localStorage
2. Keep the same method signatures and return types
3. Update `useDailyData.ts` to handle async operations
4. No changes needed in components!

### Running Tests

```bash
# Type checking
pnpm check

# Format code
pnpm format

# Build for production
pnpm build
```

### Debugging

1. **Browser DevTools** - Open F12 to inspect elements and console
2. **localStorage** - View data in DevTools > Application > Local Storage
3. **Export data** - Call `storageService.exportAllData()` in console to see all data
4. **Clear data** - Call `storageService.clearAllData()` in console to reset

### Component Structure

```
Home (page)
├── DateNavigator
├── DailySummary
│   └── MacroCircle (x4)
├── AddMealForm (conditional)
├── MealList
│   └── MealEntry (x N)
└── GoalSettingsDialog
```

### Adding a New Component

1. Create file in `client/src/components/MyComponent.tsx`
2. Use shadcn/ui components for consistency
3. Follow the existing component patterns:
```typescript
interface MyComponentProps {
  // Props here
}

export function MyComponent({ }: MyComponentProps) {
  return (
    <div className="...">
      {/* JSX here */}
    </div>
  );
}
```

### Common Tasks

#### Change default daily goals
File: `client/src/lib/storageService.ts`
```typescript
const DEFAULT_GOAL: Goal = {
  calories: 2000,  // Change here
  protein: 150,
  fat: 65,
  carbs: 250,
};
```

#### Add new meal type
File: `client/src/types/index.ts`
```typescript
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-workout';
```

Then update `MealList.tsx` and `AddMealForm.tsx` to include the new type.

#### Change animation speed
File: `client/src/index.css`
```css
@keyframes fade-in-up {
  /* Change 0.3s to desired duration */
  animation: fade-in-up 0.3s ease-out;
}
```

### Performance Tips

1. **Memoize expensive computations** - Use `useMemo` for complex calculations
2. **Lazy load components** - Use `React.lazy()` for heavy components
3. **Optimize re-renders** - Use `useCallback` for event handlers
4. **Minimize localStorage access** - Cache data in state when possible

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Data not persisting | Check browser's localStorage is enabled |
| Styles not applying | Clear browser cache and rebuild |
| Buttons not responding | Check console for JavaScript errors |
| Form validation failing | Verify input values are numbers, not strings |
| Date navigation broken | Check dateUtils.ts for date format issues |

### Resources

- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn/ui Components](https://ui.shadcn.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Wouter Router](https://github.com/molefrog/wouter)

### Getting Help

1. Check `ARCHITECTURE.md` for system design
2. Review existing components for patterns
3. Check browser console for error messages
4. Use `exportAllData()` to debug data issues
5. Test in different browsers for compatibility
