"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PROVIDERS = [
  { id: "alidns", name: "AliDNS", url: "https://9999.alidns.com/resolve", region: "CN" },
  { id: "tencent", name: "DNSPod (Tencent)", url: "https://sm2.doh.pub/resolve", region: "CN" },
  { id: "360", name: "360 DoH", url: "https://doh.360.cn/resolve", region: "CN" },
  { id: "cloudflare", name: "Cloudflare", url: "https://cloudflare-dns.com/dns-query", region: "Global" },
  { id: "google", name: "Google", url: "https://dns.google/resolve", region: "Global" },
  { id: "quad9", name: "Quad9", url: "https://dns.quad9.net:5053/dns-query", region: "Global" },
  { id: "adguard", name: "AdGuard", url: "https://dns.adguard-dns.com/resolve", region: "Global" },
];

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA", "SRV", "PTR"];

const HISTORY_KEY = "doh-online-history";

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
  Question?: { name: string; type: number }[];
}

interface HistoryEntry {
  domain: string;
  type: string;
  provider: string;
  time: string;
  answers: number;
}

const TYPE_NAMES: Record<number, string> = {
  1: "A", 28: "AAAA", 5: "CNAME", 15: "MX", 16: "TXT",
  2: "NS", 6: "SOA", 257: "CAA", 33: "SRV", 12: "PTR",
};

export default function Home() {
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("A");
  const [provider, setProvider] = useState("alidns");
  const [ecs, setEcs] = useState("");
  const [cd, setCd] = useState(false);
  const [doDnssec, setDoDnssec] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DohResponse | null>(null);
  const [error, setError] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      setHistory(h);
    } catch {}
  }, []);

  const query = useCallback(async () => {
    if (!domain.trim()) { setError("Please enter a domain name."); return; }
    setLoading(true); setError(""); setResult(null); setRawJson("");

    const p = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
    const params = new URLSearchParams({ name: domain.trim(), type });
    if (ecs) params.set("edns_client_subnet", ecs);
    if (cd) params.set("cd", "1");
    if (doDnssec) params.set("do", "1");

    try {
      const res = await fetch(`${p.url}?${params}`, {
        headers: { Accept: "application/dns-json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DohResponse = await res.json();
      setResult(data);
      setRawJson(JSON.stringify(data, null, 2));

      const entry: HistoryEntry = {
        domain: domain.trim(), type, provider: p.name,
        time: new Date().toLocaleTimeString(),
        answers: data.Answer?.length ?? 0,
      };
      const h = [entry, ...JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }, [domain, type, provider, ecs, cd, doDnssec]);

  const rcode = result?.Status === 0 ? "NOERROR" : `RCODE ${result?.Status}`;

  return (
    <main className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">DoH Online</h1>
      <p className="text-muted-foreground text-sm mb-6">
        DNS-over-HTTPS query tool · {PROVIDERS.length} providers
      </p>

      <Card>
        <CardHeader><CardTitle>Query</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com" onKeyDown={(e) => e.key === "Enter" && query()} />
            </div>
            <div className="w-32">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECORD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={query} disabled={loading}>
                {loading ? "Querying…" : "Resolve"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.region})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ecs">ECS (optional)</Label>
              <Input id="ecs" value={ecs} onChange={(e) => setEcs(e.target.value)}
                placeholder="e.g. 1.2.3.0/24" />
            </div>
            <div className="flex gap-6 items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch id="cd" checked={cd} onCheckedChange={setCd} />
                <Label htmlFor="cd">CD</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="do" checked={doDnssec} onCheckedChange={setDoDnssec} />
                <Label htmlFor="do">DO</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mt-4 border-destructive">
          <CardContent className="pt-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Results</CardTitle>
            <Badge variant={result.Status === 0 ? "default" : "destructive"}>{rcode}</Badge>
          </CardHeader>
          <CardContent>
            {result.Answer?.length ? (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">TTL</th><th className="py-2">Data</th>
                </tr></thead>
                <tbody>
                  {result.Answer.map((a, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{a.name}</td>
                      <td className="py-2 pr-4">{TYPE_NAMES[a.type] ?? a.type}</td>
                      <td className="py-2 pr-4">{a.TTL}</td>
                      <td className="py-2 font-mono text-xs break-all">{a.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground">No answer records.</p>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">Raw JSON</summary>
              <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto">{rawJson}</pre>
            </details>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">History</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => {
              localStorage.removeItem(HISTORY_KEY); setHistory([]);
            }}>Clear</Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 20).map((h, i) => (
                <Badge key={i} variant="outline" className="cursor-pointer"
                  onClick={() => { setDomain(h.domain); setType(h.type); }}>
                  {h.domain} ({h.type}) · {h.provider}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
