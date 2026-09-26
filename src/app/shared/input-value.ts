// The current text of the <input>, <textarea> or <select> an event came from, for templates:
// (input)="name.set(inputValue($event))". Typed, so templates don't need $any($event.target).value,
// which switches off template type checking for the whole expression.
export function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}
