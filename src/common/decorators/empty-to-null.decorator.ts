import { Transform } from 'class-transformer';

export function EmptyToNull() {
  return Transform(({ value }) => {
    if (
      value === '' ||
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return null;
    }
    return value;
  });
}
