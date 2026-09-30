/** Element lookup and cheap attribute writes for the imperatively drawn globe. */

export interface Elements {
  gradients: Map<string, SVGRadialGradientElement>;
  layers: Map<string, SVGPathElement | SVGCircleElement>;
  night: SVGPathElement[];
  routes: Map<string, Map<string, SVGPathElement>>;
  markers: Map<string, SVGGElement>;
  labels: Map<string, SVGTextElement>;
}

export const setD = (el: Element | undefined, d: string | null | undefined) => {
  if (!el) return;
  const next = d || 'M0,0';
  if (el.getAttribute('d') !== next) el.setAttribute('d', next);
};
export const setAttr = (el: Element | undefined, name: string, value: string) => {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
};

export function collectElements(svg: SVGSVGElement): Elements {
  const els: Elements = { gradients: new Map(), layers: new Map(), night: [], routes: new Map(), markers: new Map(), labels: new Map() };
  svg.querySelectorAll<SVGRadialGradientElement>('[data-grad]').forEach((g) => els.gradients.set(g.dataset.grad!, g));
  svg.querySelectorAll<SVGPathElement>('[data-layer]').forEach((l) => els.layers.set(l.dataset.layer!, l));
  els.night = [...svg.querySelectorAll<SVGPathElement>('[data-night]')];
  svg.querySelectorAll<SVGGElement>('[data-route]').forEach((g) => {
    const parts = new Map<string, SVGPathElement>();
    g.querySelectorAll<SVGPathElement>('[data-part]').forEach((p) => parts.set(p.dataset.part!, p));
    els.routes.set(g.dataset.route!, parts);
  });
  svg.querySelectorAll<SVGGElement>('[data-marker]').forEach((m) => els.markers.set(m.dataset.marker!, m));
  svg.querySelectorAll<SVGTextElement>('[data-label]').forEach((t) => els.labels.set(t.dataset.label!, t));
  return els;
}
