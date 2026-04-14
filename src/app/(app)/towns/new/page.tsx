"use client";
import { toast } from "sonner";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Pin } from "lucide-react";

type Station = { c: string; n: string; p: string };

export default function NewTownPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [name, setName] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showStationList, setShowStationList] = useState(false);
  const [visited, setVisited] = useState(true);
  const [visitedAt, setVisitedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/stations.json")
      .then((r) => r.json())
      .then(setStations);
  }, []);

  const filteredStations = useMemo(() => {
    if (!stationQuery.trim()) return [];
    const q = stationQuery.trim().toLowerCase();
    return stations.filter((s) => s.n.toLowerCase().includes(q)).slice(0, 20);
  }, [stationQuery, stations]);

  function selectStation(s: Station) {
    setSelectedStation(s);
    setStationQuery(s.n);
    setShowStationList(false);
    if (!name) setName(s.n + "エリア");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.couple_id || !selectedStation) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("towns")
      .insert({
        couple_id: profile.couple_id,
        name,
        station: selectedStation.n + "駅",
        station_code: selectedStation.c,
        visited,
        visited_at: visited ? visitedAt : null,
        lat: 0,
        lng: 0,
      })
      .select()
      .single();

    if (error) {
      toast.error("登録に失敗しました: " + error.message);
      setSubmitting(false);
      return;
    }

    router.push(`/towns/${data.id}`);
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">新しい町を登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Visited toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisited(true)}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                  visited
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border"
                }`}
              >
                <Check size={20} />
                行った町
              </button>
              <button
                type="button"
                onClick={() => setVisited(false)}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                  !visited
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border"
                }`}
              >
                <Pin size={20} />
                行きたい町
              </button>
            </div>

            {/* Station search */}
            <div className="space-y-2">
              <Label>最寄り駅 *</Label>
              <div className="relative">
                <Input
                  value={stationQuery}
                  onChange={(e) => {
                    setStationQuery(e.target.value);
                    setSelectedStation(null);
                    setShowStationList(true);
                  }}
                  onFocus={() => setShowStationList(true)}
                  placeholder="駅名を入力して検索..."
                  className="h-12 text-base"
                />
                {showStationList && filteredStations.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredStations.map((s) => (
                      <button
                        key={s.c}
                        type="button"
                        onClick={() => selectStation(s)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted border-b last:border-b-0 flex justify-between items-center"
                      >
                        <span className="font-medium">{s.n}駅</span>
                        <span className="text-xs text-muted-foreground">
                          {s.p}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedStation && (
                <p className="text-xs text-primary inline-flex items-center gap-1">
                  <Check size={12} /> {selectedStation.n}駅（{selectedStation.p}）を選択中
                </p>
              )}
            </div>

            {/* Town name */}
            <div className="space-y-2">
              <Label htmlFor="name">町の名前 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 三軒茶屋エリア"
                required
                className="h-12 text-base"
              />
            </div>

            {visited && (
              <div className="space-y-2">
                <Label htmlFor="visited_at">訪問日</Label>
                <Input
                  id="visited_at"
                  type="date"
                  value={visitedAt}
                  onChange={(e) => setVisitedAt(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={submitting || !selectedStation || !name.trim()}
            >
              {submitting ? "登録中..." : "この町を登録する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
