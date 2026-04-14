"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Town, Rating, CoupleCondition, ConditionPriority, TownRecommendation } from "@/types/database";
import { RATING_CATEGORIES, type RatingKey } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Train, Home, ShoppingCart, TreePine, UtensilsCrossed, Coins, Heart, BarChart3, Scale } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

type TownWithRatings = Town & { ratings: Rating[] };

type TownScore = {
  town: Town;
  averages: Record<RatingKey, number>;
  totalAvg: number;
};

const RATING_ICON_MAP: Record<string, React.ReactNode> = {
  living_env: <Home size={14} />,
  transport: <Train size={14} />,
  shopping: <ShoppingCart size={14} />,
  nature: <TreePine size={14} />,
  dining: <UtensilsCrossed size={14} />,
  rent: <Coins size={14} />,
  overall: <Heart size={14} />,
};

export default function RankingPage() {
  const { profile } = useAuth();
  const [townScores, setTownScores] = useState<TownScore[]>([]);
  const [recommendations, setRecommendations] = useState<TownRecommendation[]>([]);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.couple_id) {
      setLoading(false);
      return;
    }
    loadData();
  }, [profile?.couple_id]);

  async function loadData() {
    const { data } = await supabase
      .from("towns")
      .select("*, ratings(*)")
      .eq("couple_id", profile!.couple_id!)
      .order("created_at", { ascending: false });

    const towns = (data as TownWithRatings[]) ?? [];

    const scores: TownScore[] = towns
      .filter((t) => t.ratings.length > 0)
      .map((t) => {
        const averages = {} as Record<RatingKey, number>;
        for (const cat of RATING_CATEGORIES) {
          const vals = t.ratings.map(
            (r) => r[cat.key as keyof Rating] as number
          );
          averages[cat.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
        const allVals = Object.values(averages);
        const totalAvg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
        return { town: t, averages, totalAvg };
      })
      .sort((a, b) => b.totalAvg - a.totalAvg);

    setTownScores(scores);
    if (scores.length >= 2) {
      setCompareIds([scores[0].town.id, scores[1].town.id]);
    }
    setLoading(false);
  }

  function getCompareData() {
    if (!compareIds || townScores.length < 2) return null;
    const a = townScores.find((s) => s.town.id === compareIds[0]);
    const b = townScores.find((s) => s.town.id === compareIds[1]);
    if (!a || !b) return null;

    return RATING_CATEGORIES.map((cat) => ({
      category: cat.label,
      [a.town.name]: a.averages[cat.key],
      [b.town.name]: b.averages[cat.key],
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse"><Trophy size={28} /></div>
      </div>
    );
  }

  const compareData = getCompareData();
  const town1 = compareIds
    ? townScores.find((s) => s.town.id === compareIds[0])
    : null;
  const town2 = compareIds
    ? townScores.find((s) => s.town.id === compareIds[1])
    : null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">ランキング</h1>

      <Tabs defaultValue="ranking">
        <TabsList className="w-full">
          <TabsTrigger value="ranking" className="flex-1">
            総合順位
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex-1">
            比較
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-3 mt-4">
          {townScores.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4"><BarChart3 size={40} className="mx-auto text-muted-foreground" /></div>
              <p className="text-muted-foreground">
                評価済みの町がありません
              </p>
            </div>
          ) : (
            townScores.map((score, index) => (
              <Card
                key={score.town.id}
                className={
                  index === 0 ? "border-emerald-400 border-2" : undefined
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-muted-foreground w-8 text-center">
                      {`${index + 1}.`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {score.town.name}
                      </h3>
                      {score.town.station && (
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Train size={12} /> {score.town.station}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">
                        {score.totalAvg.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">/ 5.0</div>
                    </div>
                  </div>

                  {/* Category mini-bars */}
                  <div className="mt-3 grid grid-cols-7 gap-1">
                    {RATING_CATEGORIES.map((cat) => (
                      <div key={cat.key} className="text-center">
                        <div className="text-xs mb-1 flex justify-center">{RATING_ICON_MAP[cat.key] ?? cat.icon}</div>
                        <div className="h-12 bg-muted rounded-full relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-primary/20 rounded-full"
                            style={{
                              height: `${(score.averages[cat.key] / 5) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs mt-0.5 font-medium">
                          {score.averages[cat.key].toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Category Winners */}
          {townScores.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">項目別No.1</h3>
                <div className="space-y-2">
                  {RATING_CATEGORIES.map((cat) => {
                    const best = [...townScores].sort(
                      (a, b) => b.averages[cat.key] - a.averages[cat.key]
                    )[0];
                    return (
                      <div
                        key={cat.key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="inline-flex items-center gap-1">
                          {RATING_ICON_MAP[cat.key] ?? cat.icon} {cat.label}
                        </span>
                        <span className="font-medium">
                          {best.town.name}{" "}
                          <span className="text-primary">
                            ({best.averages[cat.key].toFixed(1)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4 mt-4">
          {townScores.length < 2 ? (
            <div className="text-center py-12">
              <div className="mb-4"><Scale size={40} className="mx-auto text-muted-foreground" /></div>
              <p className="text-muted-foreground">
                比較するには2つ以上の町を評価してください
              </p>
            </div>
          ) : (
            <>
              {/* Town selectors */}
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((idx) => (
                  <select
                    key={idx}
                    className="w-full h-12 px-3 rounded-lg border bg-background text-sm"
                    value={compareIds?.[idx] ?? ""}
                    onChange={(e) => {
                      setCompareIds((prev) => {
                        const next = [...(prev ?? ["", ""])] as [
                          string,
                          string,
                        ];
                        next[idx] = e.target.value;
                        return next;
                      });
                    }}
                  >
                    {townScores.map((s) => (
                      <option key={s.town.id} value={s.town.id}>
                        {s.town.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>

              {/* Radar Chart */}
              {compareData && town1 && town2 && (
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={compareData}>
                        <PolarGrid />
                        <PolarAngleAxis
                          dataKey="category"
                          tick={{ fontSize: 11 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 5]}
                          tick={{ fontSize: 10 }}
                        />
                        <Radar
                          name={town1.town.name}
                          dataKey={town1.town.name}
                          stroke="#ec4899"
                          fill="#ec4899"
                          fillOpacity={0.2}
                        />
                        <Radar
                          name={town2.town.name}
                          dataKey={town2.town.name}
                          stroke="#8b5cf6"
                          fill="#8b5cf6"
                          fillOpacity={0.2}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Score comparison */}
              {town1 && town2 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    {RATING_CATEGORIES.map((cat) => {
                      const v1 = town1.averages[cat.key];
                      const v2 = town2.averages[cat.key];
                      const winner =
                        v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
                      return (
                        <div
                          key={cat.key}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className={`w-8 text-right font-medium ${winner === 1 ? "text-emerald-500" : ""}`}
                          >
                            {v1.toFixed(1)}
                          </span>
                          <div className="flex-1 text-center text-xs inline-flex items-center justify-center gap-1">
                            {RATING_ICON_MAP[cat.key] ?? cat.icon} {cat.label}
                          </div>
                          <span
                            className={`w-8 font-medium ${winner === 2 ? "text-violet-500" : ""}`}
                          >
                            {v2.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
