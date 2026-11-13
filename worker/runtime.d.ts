// Minimal platform surface used here. Verified with workerd, not a browser shim.
interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(text: string, options?: { html?: false }): void;
}
declare class HTMLRewriter {
  on(selector: string, handler: { element(element: RewriterElement): void }): HTMLRewriter;
  transform(response: Response): Response;
}
