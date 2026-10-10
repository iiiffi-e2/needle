import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addSubnet("224.0.0.0", 4, "ipv4");
blocked.addAddress("255.255.255.255", "ipv4");
blocked.addAddress("::", "ipv6");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");

export type HostLookup = (host: string) => Promise<string[]>;

export function isBlockedAddress(address: string): boolean {
  const zone = address.indexOf("%");
  const ip = zone === -1 ? address : address.slice(0, zone);
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) return blocked.check(ip, "ipv6");
  return true;
}

function isRefusedName(host: string): boolean {
  return (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".invalid")
  );
}

async function defaultLookup(host: string): Promise<string[]> {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function assertPublicHost(
  host: string,
  lookupFn: HostLookup = defaultLookup
): Promise<boolean> {
  const name = host.trim().toLowerCase().replace(/\.$/, "");
  if (isRefusedName(name)) return false;
  let addresses: string[];
  try {
    addresses = await lookupFn(name);
  } catch {
    return false;
  }
  if (addresses.length === 0) return false;
  return addresses.every((address) => !isBlockedAddress(address));
}
