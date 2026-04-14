"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  buildScoreVector,
  scoreTowns,
  getCoupleType,
  getRentLimit,
  type TownProfile,
} from "@/lib/diagnosis";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Pin, RefreshCw, Home } from "lucide-react";

export default function ResultPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [towns, setTowns] = useState<TownProfile[]>([]);
  const [results, setResults] = useState<{ town: TownProfile; score: number }[]>([]);
  const [coupleType, setCoupleType] = useState<{ icon: string; label: string }>({ icon: "", label: "" });
  const [loading, setLoading] = useState(true);
  const [addingTown, setAddingTown] = useState<string | null>(null);

  useEffect(() => {
    const answersStr = sessionStorage.getItem("diagnosis_answers");
    if (!answersStr) {
      router.replace("/diagnosis");
      return;
    }

    const answers = JSON.parse(answersStr);

    fetch("/town-profiles.json")
      .then((r) => r.json())
      .then((townData: TownProfile[]) => {
        setTowns(townData);
        const scores = buildScoreVector(answers);
        const rentLimit = getRentLimit(answers);
        const scored = scoreTowns(townData, scores, rentLimit);
        setResults(scored.slice(0, 5));
        setCoupleType(getCoupleType(scores));
        setLoading(false);
      });
  }, [router]);

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
      toast.success(`${town.name}を行きたいリストに追加しました！`);
    }
    setAddingTown(null);
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-bounce"><Sparkles size={48} className="mx-auto text-primary" /></div>
          <p className="text-sm text-muted-foreground animate-pulse">
            二人にぴったりの町を探しています...
          </p>
        </div>
      </div>
    );
  }

  const medals = ["1.", "2.", "3.", "4.", "5."];

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto pb-20">
      {/* Couple type */}
      <Card className="border-primary border-2">
        <CardContent className="p-6 text-center space-y-3">
          <div className="text-5xl">{coupleType.icon}</div>
          <h1 className="text-xl font-bold">あなたたちは...</h1>
          <p className="text-2xl font-bold text-primary">{coupleType.label}</p>
        </CardContent>
      </Card>

      {/* Results */}
      <h2 className="font-bold text-lg">おすすめの町 TOP5</h2>
      <div className="space-y-3">
        {results.map((result, i) => (
          <Card key={result.town.code} className={i === 0 ? "border-emerald-400 border-2" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl font-bold w-8 text-center flex-shrink-0">
                  {medals[i]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{result.town.name}</h3>
                    <span className="text-xs text-muted-foreground">{result.town.pref}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.town.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.town.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      家賃目安: {(result.town.rent2ldk / 10000).toFixed(1)}万円
                    </span>
                    <span className="text-sm font-bold text-primary">
                      相性 {result.score}%
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => addToWishlist(result.town)}
                disabled={addingTown === result.town.code}
              >
                {addingTown === result.town.code
                  ? "追加中..."
                  : <span className="inline-flex items-center gap-1"><Pin size={14} /> 行きたいリストに追加</span>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="text-4xl mb-2">...</p>
            <p>条件に合う町が見つかりませんでした</p>
            <p className="text-xs mt-1">家賃の上限を上げてみてください</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <Button
          onClick={() => {
            sessionStorage.removeItem("diagnosis_answers");
            router.push("/diagnosis/quiz");
          }}
          variant="outline"
          className="w-full h-12"
        >
          <span className="inline-flex items-center gap-1"><RefreshCw size={16} /> もう一度診断する</span>
        </Button>
        <Link href="/">
          <Button variant="outline" className="w-full h-12">
            <span className="inline-flex items-center gap-1"><Home size={16} /> ホームに戻る</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
