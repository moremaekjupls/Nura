import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import db from './db.js';
import { COOKIE_NAME, ONE_YEAR_MS } from '../shared/const.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Entry {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  mealType?: string;
  time?: string;
}

interface Goal {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface DbEntry {
  id: string;
  session_id: string;
  date: string;
  name: string;
  calories