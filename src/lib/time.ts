export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildTimeOptions(startTime: string, endTime: string, stepMinutes = 30) {
  const options: string[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (let current = startMinutes; current <= endMinutes; current += stepMinutes) {
    const hours = String(Math.floor(current / 60)).padStart(2, "0");
    const minutes = String(current % 60).padStart(2, "0");
    options.push(`${hours}:${minutes}`);
  }

  return options;
}
