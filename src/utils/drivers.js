export const F1_DRIVERS = [
  'Max Verstappen',
  'Isack Hadjar',

  'Oscar Piastri',
  'Lando Norris',

  'Lewis Hamilton',
  'Charles Leclerc',

  'George Russell',
  'Andrea Kimi Antonelli',

  'Pierre Gasly',
  'Franco Colapinto',

  'Fernando Alonso',
  'Lance Stroll',

  'Nico Hulkenberg',
  'Gabriel Bortoleto',

  'Carlos Sainz',
  'Alexander Albon',

  'Arvid Lindblad',
  'Liam Lawson',

  'Sergio Perez',
  'Valtteri Bottas',

  'Esteban Ocon',
  'Oliver Bearman'
];

export function isValidDriver(driverName) {
  return F1_DRIVERS.includes(driverName);
}

export function getDriverSelectOptions() {
  return F1_DRIVERS.map(driver => ({
    label: driver,
    value: driver
  }));
}

// Compatibility function for older command files
export function getDriverByCode(driverName) {
  return {
    name: driverName
  };
}

export function getDriverByName(driverName) {
  return {
    name: driverName
  };
}