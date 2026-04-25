declare module '*.astro' {
  const Component: (...args: unknown[]) => unknown;
  export default Component;
}
