function padTimePart(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatStandardDateTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);

  const year = date.getFullYear();
  const month = padTimePart(date.getMonth() + 1);
  const day = padTimePart(date.getDate());
  const hour = padTimePart(date.getHours());
  const minute = padTimePart(date.getMinutes());
  const second = padTimePart(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
