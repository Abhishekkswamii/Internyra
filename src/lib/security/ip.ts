/**
 * IP address classification for user-supplied destinations.
 *
 * Used today to explain literal-IP links in reports. It is also the range table a future
 * server-side fetch guard must enforce (after DNS resolution and on every redirect hop);
 * no outbound fetching exists in this phase.
 */

export type IpClass =
  | "public"
  | "loopback"
  | "private"
  | "link-local"
  | "metadata"
  | "multicast"
  | "reserved"
  | "unspecified"
  | "shared"
  | "documentation";

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIpv4(input: string): number[] | null {
  const m = IPV4_RE.exec(input);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

export function isIpv4(input: string): boolean {
  return parseIpv4(input) !== null;
}

export function isIpv6(input: string): boolean {
  const host = stripBrackets(input);
  return host.includes(":") && /^[0-9a-f:.]+$/i.test(host);
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

export function classifyIpv4(octets: number[]): IpClass {
  const [a, b, c] = octets;
  if (a === 169 && b === 254 && c === 169 && octets[3] === 254) return "metadata";
  if (a === 0) return "unspecified";
  if (a === 127) return "loopback";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private";
  if (a === 169 && b === 254) return "link-local";
  if (a === 100 && b >= 64 && b <= 127) return "shared";
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) {
    return "documentation";
  }
  if (a >= 224 && a <= 239) return "multicast";
  if (a >= 240 || (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19))) return "reserved";
  return "public";
}

/** Expands an IPv6 address into 8 hextets. Returns null when malformed. */
export function expandIpv6(input: string): number[] | null {
  let host = stripBrackets(input).toLowerCase();
  const zone = host.indexOf("%");
  if (zone !== -1) host = host.slice(0, zone);

  // Embedded IPv4 tail (e.g. ::ffff:127.0.0.1)
  const lastColon = host.lastIndexOf(":");
  const tail = host.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    host = `${host.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const parts = host.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (parts.length === 1 && head.length !== 8) return null;
  if (parts.length === 2 && missing < 1) return null;
  const all = [...head, ...Array(parts.length === 2 ? missing : 0).fill("0"), ...rest];
  if (all.length !== 8 || !all.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return all.map((h) => parseInt(h, 16));
}

export function classifyIpv6(hextets: number[]): IpClass {
  const [h0, h1] = hextets;
  if (hextets.every((h) => h === 0)) return "unspecified";
  if (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1) return "loopback";
  // IPv4-mapped ::ffff:a.b.c.d — classify the embedded IPv4 address
  if (hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff) {
    return classifyIpv4([hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff]);
  }
  if (h0 === 0xfd00 && h1 === 0x0ec2 && hextets.slice(2, 7).every((h) => h === 0) && hextets[7] === 0x254) return "metadata"; // AWS IMDS IPv6 fd00:ec2::254
  if ((h0 & 0xfe00) === 0xfc00) return "private"; // fc00::/7 unique local
  if ((h0 & 0xffc0) === 0xfe80) return "link-local";
  if ((h0 & 0xff00) === 0xff00) return "multicast";
  if (h0 === 0x2001 && h1 === 0x0db8) return "documentation";
  if ((h0 & 0xffc0) === 0xfec0) return "reserved"; // deprecated site-local
  if (h0 === 0x0064 && h1 === 0xff9b) return "reserved"; // NAT64
  if (h0 === 0x2002 || (h0 === 0x2001 && h1 === 0)) return "reserved"; // 6to4 / Teredo can embed private v4
  return "public";
}

/** Classifies an IPv4 or IPv6 literal. Returns null when `host` is not an IP literal. */
export function classifyIp(host: string): IpClass | null {
  const v4 = parseIpv4(host);
  if (v4) return classifyIpv4(v4);
  if (isIpv6(host)) {
    const v6 = expandIpv6(host);
    return v6 ? classifyIpv6(v6) : "reserved";
  }
  return null;
}

/** True only for globally routable unicast addresses. A future fetch guard must require this. */
export function isPublicIp(host: string): boolean {
  return classifyIp(host) === "public";
}
