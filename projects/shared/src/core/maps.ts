// Turns whatever the owner pastes into an embeddable Google Maps address:
//  - a plain address or "30.04,31.23"            -> searched on the map
//  - a Google Maps page link (with @lat,lng, /place/Name or ?q=...)
//  - the <iframe ...> code or its src from "Share -> Embed a map"
// Short links (maps.app.goo.gl) cannot be read in the browser, so null is returned for them.
export function buildMapEmbed(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();

  if (!v) return null;

  const iframe = /src=["']([^"']+)["']/i.exec(v);
  if (iframe) return buildMapEmbed(iframe[1]);

  if (/^https:\/\/www\.google\.com\/maps\/embed/i.test(v)) return v;

  if (/^https?:\/\//i.test(v)) {
    if (/goo\.gl|maps\.app/i.test(v)) return null;

    const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(v) ?? /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(v);
    if (at) return `https://maps.google.com/maps?q=${at[1]},${at[2]}&z=16&output=embed`;

    const query = /[?&](?:q|query)=([^&]+)/.exec(v);
    if (query) return `https://maps.google.com/maps?q=${query[1]}&output=embed`;

    const place = /\/maps\/place\/([^/@?]+)/.exec(v);
    if (place) return `https://maps.google.com/maps?q=${place[1]}&output=embed`;

    return null;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(v)}&output=embed`;
}
