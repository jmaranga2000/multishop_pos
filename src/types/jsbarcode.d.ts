declare module "jsbarcode" {
  export default function JsBarcode(
    element: SVGSVGElement | HTMLElement | string,
    text: string,
    options?: {
      format?: string;
      lineColor?: string;
      width?: number;
      height?: number;
      displayValue?: boolean;
      fontSize?: number;
      margin?: number;
      background?: string;
      textMargin?: number;
      [key: string]: unknown;
    }
  ): void;
}
