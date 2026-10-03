const DEFAULT_F1_DRIVERS = [
  'Max Verstappen', 'Isack Hadjar', 'Oscar Piastri', 'Lando Norris',
  'Lewis Hamilton', 'Charles Leclerc', 'George Russell', 'Kimi Antonelli',
  'Pierre Gasly', 'Franco Colapinto', 'Fernando Alonso', 'Lance Stroll',
  'Nico Hulkenberg', 'Gabriel Bortoleto', 'Carlos Sainz', 'Alexander Albon',
  'Arvid Lindblad', 'Liam Lawson', 'Sergio Perez', 'Valtteri Bottas',
  'Esteban Ocon', 'Oliver Bearman'
];

export const F1_DRIVERS = (process.env.F1_DRIVERS || '')
  .split(',')
  .map(driver => driver.trim())
  .filter(Boolean)
  .filter((driver, index, list) => list.indexOf(driver) === index);

if (F1_DRIVERS.length < 3) F1_DRIVERS.push(...DEFAULT_F1_DRIVERS.filter(driver => !F1_DRIVERS.includes(driver)));

export function isValidDriver(driverName) { return F1_DRIVERS.includes(driverName); }
export function getDriverSelectOptions() { return F1_DRIVERS.map(driver => ({ label: driver, value: driver })); }
export function getDriverByCode(driverName) { return { name: driverName }; }
export function getDriverByName(driverName) { return { name: driverName }; }
