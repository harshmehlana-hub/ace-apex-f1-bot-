import { F1_DRIVERS } from './drivers.js';

export function validatePodiumSelection(p1, p2, p3) {
  const errors = [];
  if (!F1_DRIVERS.includes(p1)) errors.push(`Invalid P1 driver: ${p1}`);
  if (!F1_DRIVERS.includes(p2)) errors.push(`Invalid P2 driver: ${p2}`);
  if (!F1_DRIVERS.includes(p3)) errors.push(`Invalid P3 driver: ${p3}`);
  if (new Set([p1, p2, p3]).size !== 3) errors.push('Each podium position must have a different driver');
  return { valid: errors.length === 0, errors };
}

export function isAdmin(member, adminRoleId) {
  return Boolean(member?.roles?.cache?.has(adminRoleId) || member?.permissions?.has('Administrator'));
}

export function parseISTDateTime(dateStr, timeStr) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [day, month, year] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const utcMs = Date.UTC(year, month - 1, day, hours - 5, minutes - 30);
  const date = new Date(utcMs);
  const ist = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((obj, part) => { obj[part.type] = part.value; return obj; }, {});
  if (`${ist.day}-${ist.month}-${ist.year}` !== `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}` || `${ist.hour}:${ist.minute}` !== timeStr) return null;
  return date;
}
