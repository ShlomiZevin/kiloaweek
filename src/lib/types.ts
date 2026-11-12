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

export type MealItem = { he: string; calories: number };
export type Meal = {
  id: string;
  date: string;
  at: number;
  he: string;
  items: MealItem[];
  calories: number;
  protein?: number;
  verdict: 'ok' | 'warn' | 'no';
  why?: string;
  thumb?: string; // small jpeg data url
  text?: string;
};

export type ChatMsg = {
  id: string; role: 'user' | 'assistant'; text: string; at: number; thumb?: string;
  voice?: boolean; // the user's message came from a voice recording
  meal?: { id: string; he: string; calories: number; verdict: 'ok' | 'warn' | 'no'; removed?: boolean }; // a meal the coach logged
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
  imported?: boolean;
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
