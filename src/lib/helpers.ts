export function titleCase(string_: string) {
  const words = string_.split(" ");
  for (const [index, currentWord] of words.entries()) {
    words[index] = currentWord.charAt(0).toUpperCase() + currentWord.slice(1).toLowerCase();
  }

  return words.join(" ");
}
