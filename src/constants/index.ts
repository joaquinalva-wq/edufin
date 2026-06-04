export * from './products';
export * from './locations';
export * from './matrix';
export * from './investments';
export * from './events';

export const INITIAL_CAPITAL = 100_000;
export const TOTAL_ROUNDS = 10;
export const DEFAULT_CLOSE_TIME = '22:00';
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
export const JOIN_CODE_LENGTH = 6;
export const INITIAL_BRAND_STRENGTH = 0;
export const INITIAL_CUSTOMER_SATISFACTION = 0.5;
export const INITIAL_EMPLOYEE_MORALE = 0.5;
export const LIQUIDITY_CRISIS_THRESHOLD = 0.15; // 15% of starting capital
export const INACTIVITY_PENALTY = 0.05;          // 5% efficiency penalty

export const MARKETING_CHANNELS = [
  'social_media',
  'influencers',
  'local_advertising',
  'promotions',
  'events',
  'school_university',
  'word_of_mouth',
] as const;
