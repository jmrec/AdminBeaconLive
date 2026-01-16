// @flow
// This explicitly tells Flow to recognize the DOM
declare var document: Document;
declare var window: Window;
declare class HTMLElement extends Element {
    innerHTML: string;
    innerText: string;
    classList: any;
    style: any;
    +value?: string; // Some elements have values
}
declare class HTMLCanvasElement extends HTMLElement {
    getContext(type: string): any;
}
declare class HTMLInputElement extends HTMLElement {
    value: string;
}