export type Tags = { strength?: boolean; aerobic?: boolean; cheat?: boolean };

/** One calendar day (Israel time), doc id = YYYY-MM-DD. Weights in kg. */
export type Day = {
  date: string;
  morning?: number | null;
  evening?: number | null;
  morningAt?: number; // ms
  eveningAt?: number;
  tags?: Tags;
  water?: number; // ml
  sleep?: number; // hours slept the night before this morning
  sweets?: number; // sugar-free sweets eaten (method: up to 6)
  note?: string;
};

export type ActType = 'pee' | 'poop' | 'run' | 'walk' | 'swim' | 'bike' | 'strength' | 'other';

/** A before / after weighing. Open while afterKg is missing. */
export type Measure = {
  id: string;
  type: ActType;
  label?: string; // for "other"
  beforeKg: number;
  afterKg?: number | null;
  drinkMl?: number;
  startedAt: number;
  endedAt?: number | null;
  minutes?: number | null;
  note?: string;
};

/** Counted mainly in protein / carbs / sugars (grams), plus calories. */
export type MealItem = { he: string; calories: number; protein?: number; carbs?: number; sugar?: number };
export type Meal = {
  id: string;
  date: string;
  at: number;
  he: string;
  items: MealItem[];
  calories: number;
  protein?: number;
  carbs?: number;
  sugar?: number;
  verdict: 'ok' | 'warn' | 'no';
  why?: string;
  thumb?: string; // small jpeg data url
  text?: string;
};
export type MealCore = Omit<Meal, 'id' | 'date' | 'at'>;

/** The meal library: every meal she logged, kept once by name, to add again in one tap. Doc id = normalized name. */
export type SavedMeal = MealCore & { id: string; n: number; lastAt: number };

/** A log card the coach offers in the chat; the user adds it with one tap. */
export type LogCard =
  | { kind: 'meal'; meal: MealCore; added?: string; removed?: boolean } // added = the meal id once added
  | { kind: 'weight'; slot: 'morning' | 'evening'; kg: number; added?: string; removed?: boolean } // added = the date
  | { kind: 'water'; ml: number; added?: string; removed?: boolean };

export type ChatMsg = {
  id: string; role: 'user' | 'assistant'; text: string; at: number; thumb?: string;
  voice?: boolean; // the user's message came from a voice recording
  meal?: { id: string; he: string; calories: number; verdict: 'ok' | 'warn' | 'no'; removed?: boolean }; // old: a meal the coach logged by itself
  logs?: LogCard[]; // log cards the coach offered
};

export type Profile = {
  name?: string;
  email?: string;
  photo?: string;
  heightCm?: number;
  startWeight?: number;
  goalWeight?: number;
  weeklyGoalG?: number; // default 800
  calorieTarget?: number;
  reminders?: { on: boolean; morning: string; evening: string };
  createdAt?: number;
  analysis?: { date: string; at: number; result: Analysis };
};

/** The multi-day analyst's answer (server /analysis). */
export type Analysis = {
  status: 'on_track' | 'stall_on_plan' | 'off_plan' | 'not_enough_data';
  headline: string;
  insights: { title: string; text: string }[];
  calm: string | null;
  next: string[];
  missing: string | null;
};
