/**
 * Home Page
 * Main calorie tracker interface with daily summary, meal list, and controls
 */

import React, { useState, useEffect } from 'react';
import { getTodayISO } from '@/lib/dateUtils';
import { useDailyData } from '@/hooks/useDailyData';
import { Entry } from '@/types';
import { DailySummary } from '@/components/DailySummary';
import { MealList } from '@/components/MealList';
import { AddMealForm } from '@/components/AddMealForm';
import { DateNavigator } from '@/components/DateNavigator';
import { GoalSettingsDialog } from '@/components/GoalSettingsDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(getTodayISO());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showGoalDialog, setShowGoalDialog] = useState(false);

  const { summary, loading, addEntry, updateEntry, deleteEntry, updateGoal } =
    useDailyData(currentDate);

  // Handle adding/updating a meal
  const handleSubmitMeal = (entry: Omit<Entry, 'id'>) => {
    if (editingEntry) {
      updateEntry(editingEntry.id, entry);
      toast.success('Meal updated');
      setEditingEntry(null);
    } else {
      addEntry(entry);
      toast.success('Meal added');
    }
    setShowAddForm(false);
  };

  // Handle editing a meal
  const handleEditMeal = (entry: Entry) => {
    setEditingEntry(entry);
    setShowAddForm(true);
  };

  // Handle deleting a meal
  const handleDeleteMeal = (id: string) => {
    deleteEntry(id);
    toast.success('Meal deleted');
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingEntry(null);
    setShowAddForm(false);
  };

  if (loading || !summary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-display font-bold text-primary">CaloTrack</h1>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Meal</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6 space-y-6">
        {/* Date navigator */}
        <DateNavigator date={currentDate} onDateChange={setCurrentDate} />

        {/* Daily summary */}
        <DailySummary summary={summary} onEditGoal={() => setShowGoalDialog(true)} />

        {/* Add meal form */}
        {showAddForm && (
          <div className="animate-scale-in">
            <AddMealForm
              date={currentDate}
              editingEntry={editingEntry}
              onSubmit={handleSubmitMeal}
              onCancel={handleCancelEdit}
            />
          </div>
        )}

        {/* Meal list */}
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground mb-4">
            Meals
          </h2>
          <MealList
            entries={summary.entries}
            onEdit={handleEditMeal}
            onDelete={handleDeleteMeal}
          />
        </div>
      </main>

      {/* Goal settings dialog */}
      <GoalSettingsDialog
        open={showGoalDialog}
        goal={summary.goal}
        onSave={updateGoal}
        onOpenChange={setShowGoalDialog}
      />

      {/* Mobile add button */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-14 w-14 shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
