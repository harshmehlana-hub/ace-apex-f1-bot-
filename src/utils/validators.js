import { F1_DRIVERS } from './drivers.js';

export function validatePodiumSelection(p1, p2, p3) {
  const errors = [];

  if (!F1_DRIVERS.includes(p1)) {
    errors.push(`Invalid P1 driver: ${p1}`);
  }

  if (!F1_DRIVERS.includes(p2)) {
    errors.push(`Invalid P2 driver: ${p2}`);
  }

  if (!F1_DRIVERS.includes(p3)) {
    errors.push(`Invalid P3 driver: ${p3}`);
  }

  const selections = [p1, p2, p3];

  if (new Set(selections).size !== 3) {
    errors.push('Each podium position must have a different driver');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isAdmin(member, adminRoleId) {
  return (
    member.roles.cache.has(adminRoleId) ||
    member.permissions.has('Administrator')
  );
}