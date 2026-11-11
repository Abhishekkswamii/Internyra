import { describe, expect, it } from "vitest";
import { classifyIp, isPublicIp } from "@/lib/security/ip";

describe("IP classification (basis for a future fetch guard)", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["127.255.0.9", "loopback"],
    ["10.1.2.3", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.255", "private"],
    ["192.168.1.1", "private"],
    ["169.254.10.10", "link-local"],
    ["169.254.169.254", "metadata"],
    ["0.0.0.0", "unspecified"],
    ["100.64.0.1", "shared"],
    ["224.0.0.1", "multicast"],
    ["240.0.0.1", "reserved"],
    ["255.255.255.255", "reserved"],
    ["198.18.0.1", "reserved"],
    ["93.184.216.34", "public"],
    ["172.32.0.1", "public"],
  ])("IPv4 %s → %s", (ip, cls) => {
    expect(classifyIp(ip)).toBe(cls);
  });

  it.each([
    ["::1", "loopback"],
    ["[::1]", "loopback"],
    ["::", "unspecified"],
    ["fc00::1", "private"],
    ["fd12:3456::1", "private"],
    ["fe80::1", "link-local"],
    ["ff02::1", "multicast"],
    ["fd00:ec2::254", "metadata"],
    ["::ffff:127.0.0.1", "loopback"],
    ["::ffff:169.254.169.254", "metadata"],
    ["::ffff:10.0.0.1", "private"],
    ["2002:7f00:1::", "reserved"],
    ["2001:db8::1", "documentation"],
    ["2606:4700:4700::1111", "public"],
  ])("IPv6 %s → %s", (ip, cls) => {
    expect(classifyIp(ip)).toBe(cls);
  });

  it("only treats globally routable unicast as public", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:192.168.0.1")).toBe(false);
    expect(isPublicIp("not-an-ip")).toBe(false);
  });

  it("returns null for hostnames", () => {
    expect(classifyIp("example.com")).toBeNull();
  });
});
