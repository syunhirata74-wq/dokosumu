"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { TownProfile, ScoreKey } from "@/lib/diagnosis";
import { getCoupleType } from "@/lib/diagnosis";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Heart, Hand, Pin, RefreshCw, Sparkles, Coffee, Moon, TreePine, Baby, ShoppingBag, UtensilsCrossed, Train, Coins, ShieldCheck, Sunset } from "lucide-react";

const SCORE_ICON_MAP: Record<string, React.ReactNode> = {
  cafe: <Coffee size={18} />,
  nightlife: <Sunset size={18} />,
  quiet: <Moon size={18} />,
  nature: <TreePine size={18} />,
  family: <Baby size={18} />,
  shopping: <ShoppingBag size={18} />,
  gourmet: <UtensilsCrossed size={18} />,
  access: <Train size={18} />,
  cost: <Coins size={18} />,
  safety: <ShieldCheck size={18} />,
};

export default function SwipeResultPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [liked, setLiked] = useState<TownProfile[]>([]);
  const [disliked, setDisliked] = useState<TownProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTown, setAddingTown] = useState<string | null>(null);

  useEffect(() => {
    const resultsStr = sessionStorage.getItem("swipe_results");
    if (!resultsStr) {
      router.replace("/diagnosis/swipe");
      return;
    }
    const results = JSON.parse(resultsStr);
    setLiked(results.liked ?? []);
    setDisliked(results.disliked ?? []);
    setLoading(false);
  }, [router]);

  // Analyze preferences from liked towns
  function analyzePreferences(): {
    topTraits: { key: string; label: string; avg: number }[];
    coupleType: { icon: string; label: string };
    avgRent: number;
  } {
    if (liked.length === 0) {
      return {
        topTraits: [],
        coupleType: { icon: "", label: "まだわからない" },
        avgRent: 0,
      };
    }

    const traitLabels: Record<string, { label: string }> = {
      cafe: { label: "おしゃれ度" },
      nightlife: { label: "夜の活気" },
      quiet: { label: "静かさ" },
      nature: { label: "自然" },
      family: { label: "ファミリー" },
      shopping: { label: "買い物" },
      gourmet: { label: "グルメ" },
      access: { label: "アクセス" },
      cost: { label: "コスパ" },
      safety: { label: "治安" },
    };

    // Average scores of liked towns
    const avgScores: Record<ScoreKey, number> = {
      cafe: 0, nightlife: 0, quiet: 0, nature: 0, family: 0,
      shopping: 0, gourmet: 0, access: 0, cost: 0, safety: 0,
    };

    for (const town of liked) {
      for (const [key, val] of Object.entries(town.scores)) {
        avgScores[key as ScoreKey] += val;
      }
    }
    for (const key of Object.keys(avgScores) as ScoreKey[]) {
      avgScores[key] /= liked.length;
    }

    const topTraits = Object.entries(avgScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([key, avg]) => ({
        key,
        label: traitLabels[key]?.label ?? key,
        avg: Math.round(avg * 10) / 10,
      }));

    const avgRent = Math.round(
      liked.reduce((s, t) => s + t.rent2ldk, 0) / liked.length
    );

    return {
      topTraits,
      coupleType: getCoupleType(avgScores),
      avgRent,
    };
  }

  async function addToWishlist(town: TownProfile) {
    if (!profile?.couple_id) {
      toast.error("カップル設定が必要です");
      return;
    }
    setAddingTown(town.code);
    const { error } = await supabase.from("towns").insert({
      couple_id: profile.couple_id,
      name: town.name + "エリア",
      station: town.name + "駅",
      station_code: town.code,
      visited: false,
      lat: 0,
      lng: 0,
    });
    if (error) {
      toast.error("追加に失敗しました");
    } else {
      toast.success(`${town.name}を追加しました！`);
    }
    setAddingTown(null);
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-pulse"><Sparkles size={32} className="mx-auto text-primary" /></div>
      </div>
    );
  }

  const { topTraits, coupleType, avgRent } = analyzePreferences();

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto pb-20">
      {/* Type */}
      <Card className="border-primary border-2">
        <CardContent className="p-6 text-center space-y-2">
          <div className="text-5xl">{coupleType.icon}</div>
          <h1 className="text-lg font-bold">あなたの好みタイプ</h1>
          <p className="text-xl font-bold text-primary">{coupleType.label}</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-500">{liked.length}</div>
            <div className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 justify-center"><Heart size={10} className="text-pink-500 fill-pink-500" /> 住みたい</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-400">{disliked.length}</div>
            <div className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 justify-center"><Hand size={10} /> パス</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{avgRent > 0 ? `${(avgRent / 10000).toFixed(0)}万` : "-"}</div>
            <div className="text-[10px] text-muted-foreground">平均家賃</div>
          </CardContent>
        </Card>
      </div>

      {/* Top traits */}
      {topTraits.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-bold text-sm mb-3">あなたが重視しているのは</h2>
            <div className="space-y-2">
              {topTraits.map((trait, i) => (
                <div key={trait.key} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}.</span>
                  <span className="text-lg">{SCORE_ICON_MAP[trait.key]}</span>
                  <span className="font-medium text-sm flex-1">{trait.label}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={`text-xs ${s <= Math.round(trait.avg) ? "text-emerald-400" : "text-gray-200"}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liked towns */}
      {liked.length > 0 && (
        <>
          <h2 className="font-bold text-sm inline-flex items-center gap-1"><Heart size={16} className="text-pink-500 fill-pink-500" /> 住みたいと思った町</h2>
          <div className="space-y-2">
            {liked.map((town) => (
              <Card key={town.code}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm">{town.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{town.pref}</span>
                      <div className="flex gap-1 mt-1">
                        {town.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addToWishlist(town)}
                      disabled={addingTown === town.code}
                      className="text-xs"
                    >
                      <span className="inline-flex items-center gap-1"><Pin size={12} /> 追加</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <Button
          onClick={() => {
            sessionStorage.removeItem("swipe_results");
            router.push("/diagnosis/swipe");
          }}
          variant="outline"
          className="w-full h-12"
        >
          <span className="inline-flex items-center gap-1"><RefreshCw size={16} /> もう一度スワイプ</span>
        </Button>
        <Link href="/diagnosis">
          <Button variant="outline" className="w-full h-12">
            <span className="inline-flex items-center gap-1"><Sparkles size={16} /> 診断トップへ</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
