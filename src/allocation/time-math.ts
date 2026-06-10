export function formatMinutes(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new Error(`Minutos invalidos: ${totalMinutes}`);
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

export function parseHourText(text: string): number {
  const match = /^(\d+)h([0-5]\d)$/.exec(text.trim());
  if (!match) {
    throw new Error(`Formato de hora invalido: ${text}`);
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function sumMinutes(items: Array<{ minutes: number }>): number {
  return items.reduce((total, item) => total + item.minutes, 0);
}
