declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: {
      DOMParser: typeof DOMParser;
      XMLSerializer: typeof XMLSerializer;
    };
  }
}
