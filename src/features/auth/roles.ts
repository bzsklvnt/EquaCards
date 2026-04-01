/** Stable role slugs; seeded in DB migrations. */
export const ROLE = {
  Admin: 'admin',
  Learner: 'learner',
} as const;

export type RoleSlug = (typeof ROLE)[keyof typeof ROLE];
