export function hasOwn(object: object, property: PropertyKey): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Storybook's ES2020 target does not provide Object.hasOwn.
  return Object.prototype.hasOwnProperty.call(object, property);
}
