export const env = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env var '${key}'`);
  return value;
};
