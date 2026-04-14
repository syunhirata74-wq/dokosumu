"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Rating, Profile } from "@/types/database";
import { RATING_CATEGORIES } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, MessageCircle, Check, Sparkles, BarChart3, Home, Train, ShoppingCart, TreePine, UtensilsCrossed, Coins, Heart } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

type ValueProfile = {
  key: string;
  label: string;
  icon: string;
  myScore: number;
  partnerScore: number;
  gap: number;
};

const RATING_ICON_MAP: Record<string, React.ReactNode> = {
  living_env: <Home size={16} />,
  transport: <Train size={16} />,
  shopping: <ShoppingCart size={16} />,
  nature: <TreePine size={16} />,
  dining: <UtensilsCrossed size={16} />,
  rent: <Coins size={16} />,
  overall: <Heart size={16} />,
};

const TALK_PROMPTS: Record<string, string[]> = {
  "住環境": [
    "静かな住宅街と便利な駅前、どっちが理想？",
    "窓からの景色、何が見えたらうれしい？",
  ],
  "交通アクセス": [
    "通勤は何を犠牲にしても短い方がいい？",
    "休日に電車で遠出するのは好き？",
  ],
  "買い物": [
    "ネットスーパーでOK？それとも歩いて行きたい？",
    "大きな買い物はどこでする派？",
  ],
  "自然・公園": [
    "朝ランニングする公園、あった方がいい？",
    "休日に自然の中で過ごす時間、どのくらいほしい？",
  ],
  "飲食店": [
    "外食は週何回くらいが理想？",
    "コンビニ弁当と外食、どっちが多くなりそう？",
  ],
  "家賃相場": [
    "家賃を抑えて趣味にお金を使う？それとも家にこだわる？",
    "家賃の上限、本音はいくら？",
  ],
  "総合": [
    "今まで見た町で、一番テンション上がったのは？",
    "5年後、どんな暮らしをしていたい？",
  ],
};

export default function ValuesPage() {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.couple_id) loadData();
  }, [profile?.couple_id]);

  async function loadData() {
    const coupleId = profile!.couple_id!;

    const [membersRes, townsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("couple_id", coupleId),
      supabase.from("towns").select("id").eq("couple_id", coupleId),
    ]);

    setMembers(membersRes.data ?? []);

    const townIds = (townsRes.data ?? []).map((t) => t.id);
    if (townIds.length > 0) {
      const { data: ratings } = await supabase
        .from("ratings")
        .select("*")
        .in("town_id", townIds);
      setAllRatings(ratings ?? []);
    }

    setLoading(false);
  }

  const me = members.find((m) => m.id === user?.id);
  const partner = members.find((m) => m.id !== user?.id);

  // Calculate average rating per category per person
  function getAvgByCategory(userId: string, key: string): number {
    const userRatings = allRatings.filter((r) => r.user_id === userId);
    if (userRatings.length === 0) return 3; // default middle
    const vals = userRatings.map((r) => r[key as keyof Rating] as number);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const values: ValueProfile[] = RATING_CATEGORIES.map((cat) => {
    const myScore = me ? getAvgByCategory(me.id, cat.key) : 3;
    const partnerScore = partner ? getAvgByCategory(partner.id, cat.key) : 3;
    return {
      key: cat.key,
      label: cat.label,
      icon: cat.icon,
      myScore: Math.round(myScore * 10) / 10,
      partnerScore: Math.round(partnerScore * 10) / 10,
      gap: Math.abs(myScore - partnerScore),
    };
  });

  const sortedByGap = [...values].sort((a, b) => b.gap - a.gap);
  const biggestGaps = sortedByGap.filter((v) => v.gap >= 0.5).slice(0, 3);
  const agreements = sortedByGap.filter((v) => v.gap < 0.5);

  const chartData = values.map((v) => ({
    category: v.label,
    [me?.name ?? "自分"]: v.myScore,
    [partner?.name ?? "相手"]: v.partnerScore,
  }));

  const hasEnoughData = allRatings.length >= 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse"><Users size={28} /></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto pb-20">
      <h1 className="text-xl font-bold">ふたりの価値観マップ</h1>
      <p className="text-sm text-muted-foreground">
        町の評価データから二人の重視ポイントを可視化
      </p>

      {!hasEnoughData ? (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div><BarChart3 size={40} className="mx-auto text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">
              町を2つ以上評価すると、二人の価値観マップが表示されます
            </p>
            <Link href="/">
              <Button variant="outline">町を評価しに行く</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Radar Chart */}
          <Card>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                  <Radar
                    name={me?.name ?? "自分"}
                    dataKey={me?.name ?? "自分"}
                    stroke="#ec4899"
                    fill="#ec4899"
                    fillOpacity={0.2}
                  />
                  <Radar
                    name={partner?.name ?? "相手"}
                    dataKey={partner?.name ?? "相手"}
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.2}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Biggest gaps */}
          {biggestGaps.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-1">
                <MessageCircle size={16} /> ここ、話し合ってみて！
              </h2>
              {biggestGaps.map((v) => {
                const prompts = TALK_PROMPTS[v.label] ?? [];
                const prompt = prompts[Math.floor(Math.random() * prompts.length)];
                const meHigher = v.myScore > v.partnerScore;
                return (
                  <Card key={v.label} className="border-emerald-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{RATING_ICON_MAP[v.key] ?? v.icon}</span>
                        <span className="font-bold text-sm">{v.label}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full ml-auto">
                          ズレ {v.gap.toFixed(1)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                        <div className="bg-emerald-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-emerald-500">{v.myScore}</div>
                          <div className="text-muted-foreground">{me?.name ?? "自分"}</div>
                        </div>
                        <div className="bg-violet-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-violet-500">{v.partnerScore}</div>
                          <div className="text-muted-foreground">{partner?.name ?? "相手"}</div>
                        </div>
                      </div>
                      {prompt && (
                        <div className="bg-muted rounded-lg p-3 text-sm">
                          <span className="text-primary font-medium">Q. </span>
                          {prompt}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Agreements */}
          {agreements.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="font-bold text-sm mb-3 flex items-center gap-1">
                  <Check size={16} className="text-green-500" /> ここは意見が合ってる！
                </h2>
                <div className="flex flex-wrap gap-2">
                  {agreements.map((v) => (
                    <span
                      key={v.label}
                      className="bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium"
                    >
                      <span className="inline-flex items-center gap-1">{RATING_ICON_MAP[v.key] ?? v.icon} {v.label}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Score details */}
          <Card>
            <CardContent className="p-4">
              <h2 className="font-bold text-sm mb-3">全項目の比較</h2>
              <div className="space-y-2">
                {values.map((v) => (
                  <div key={v.label} className="flex items-center gap-2 text-sm">
                    <span className="w-5">{RATING_ICON_MAP[v.key] ?? v.icon}</span>
                    <span className="flex-1 min-w-0 truncate text-xs">{v.label}</span>
                    <span className="w-8 text-right font-medium text-emerald-500">{v.myScore}</span>
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className="absolute left-0 top-0 h-full bg-emerald-300 rounded-full"
                        style={{ width: `${(v.myScore / 5) * 100}%` }}
                      />
                      <div
                        className="absolute left-0 top-0 h-full bg-violet-400 rounded-full opacity-50"
                        style={{ width: `${(v.partnerScore / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-left font-medium text-violet-500">{v.partnerScore}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Link href="/diagnosis">
        <Button variant="outline" className="w-full">
          <span className="inline-flex items-center gap-1"><Sparkles size={16} /> 診断をやり直す</span>
        </Button>
      </Link>
    </div>
  );
}
