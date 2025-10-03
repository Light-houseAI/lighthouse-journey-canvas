import * as ResizablePrimitive from "react-resizable-panels";
declare const ResizablePanelGroup: ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => import("react/jsx-runtime").JSX.Element;
declare const ResizablePanel: import('../../../../node_modules/.pnpm/react@18.3.1/node_modules/react').ForwardRefExoticComponent<Omit<import('../../../../node_modules/.pnpm/react@18.3.1/node_modules/react').HTMLAttributes<HTMLDivElement | HTMLElement | HTMLObjectElement | HTMLAnchorElement | HTMLButtonElement | HTMLFormElement | HTMLHeadingElement | HTMLImageElement | HTMLInputElement | HTMLLabelElement | HTMLLIElement | HTMLOListElement | HTMLParagraphElement | HTMLSelectElement | HTMLSpanElement | HTMLUListElement | HTMLAreaElement | HTMLAudioElement | HTMLBaseElement | HTMLQuoteElement | HTMLBodyElement | HTMLBRElement | HTMLCanvasElement | HTMLTableColElement | HTMLDataElement | HTMLDataListElement | HTMLModElement | HTMLDetailsElement | HTMLDialogElement | HTMLDListElement | HTMLEmbedElement | HTMLFieldSetElement | HTMLHeadElement | HTMLHRElement | HTMLHtmlElement | HTMLIFrameElement | HTMLLegendElement | HTMLLinkElement | HTMLMapElement | HTMLMetaElement | HTMLMeterElement | HTMLOptGroupElement | HTMLOptionElement | HTMLOutputElement | HTMLPreElement | HTMLProgressElement | HTMLSlotElement | HTMLScriptElement | HTMLSourceElement | HTMLStyleElement | HTMLTableElement | HTMLTemplateElement | HTMLTableSectionElement | HTMLTableCellElement | HTMLTextAreaElement | HTMLTimeElement | HTMLTitleElement | HTMLTableRowElement | HTMLTrackElement | HTMLVideoElement | HTMLTableCaptionElement | HTMLMenuElement | HTMLPictureElement>, "id" | "onResize"> & {
    className?: string | undefined;
    collapsedSize?: number | undefined;
    collapsible?: boolean | undefined;
    defaultSize?: number | undefined;
    id?: string | undefined;
    maxSize?: number | undefined;
    minSize?: number | undefined;
    onCollapse?: ResizablePrimitive.PanelOnCollapse | undefined;
    onExpand?: ResizablePrimitive.PanelOnExpand | undefined;
    onResize?: ResizablePrimitive.PanelOnResize | undefined;
    order?: number | undefined;
    style?: object | undefined;
    tagName?: keyof HTMLElementTagNameMap | undefined;
} & {
    children?: import('../../../../node_modules/.pnpm/react@18.3.1/node_modules/react').ReactNode;
} & import('../../../../node_modules/.pnpm/react@18.3.1/node_modules/react').RefAttributes<ResizablePrimitive.ImperativePanelHandle>>;
declare const ResizableHandle: ({ withHandle, className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
    withHandle?: boolean;
}) => import("react/jsx-runtime").JSX.Element;
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
//# sourceMappingURL=resizable.d.ts.map