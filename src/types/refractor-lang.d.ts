declare module 'refractor/lang/*' {
  import type { Syntax } from 'refractor/core';
  const grammar: Syntax;
  export default grammar;
}
