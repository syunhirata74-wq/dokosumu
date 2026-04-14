"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { RATING_CATEGORIES, type RatingKey } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Home, Train, ShoppingCart, TreePine, UtensilsCrossed, Coins, Heart, BarChart3 } from "lucide-react";

const RATING_ICON_MAP: Record<string, React.ReactNode> = {
  living_env: <Home size={16} />,
  transport: <Train size={16} />,
  shopping: <ShoppingCart size={16} />,
  nature: <TreePine size={16} />,
  dining: <UtensilsCrossed size={16} />,
  rent: <Coins size={16} />,
  overall: <Heart size={16} />,
};

export default function RateTownPage() {
  const params = useParams();
  const townId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const [scores, setScores] = useState<Record<RatingKey, number>>({
    living_env: 3,
    transport: 3,
    shopping: 3,
    nature: 3,
    dining: 3,
    rent: 3,
    overall: 3,
  });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExisting();
  }, [townId, user?.id]);

  async function loadExisting() {
    if (!user) return;
    const { data } = await supabase
      .from("ratings")
      .select("*")
      .eq("town_id", townId)
      .eq("user_id", user.id)
      .single();

    if (data) {
      setExistingId(data.id);
      setScores({
        living_env: data.living_env,
        transport: data.transport,
        shopping: data.shopping,
        nature: data.nature,
        dining: data.dining,
        rent: data.rent,
        overall: data.overall,
      });
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    if (existingId) {
      await supabase.from("ratings").update(scores).eq("id", existingId);
    } else {
      await supabase.from("ratings").insert({
        town_id: townId,
        user_id: user.id,
        ...scores,
      });
    }

    router.push(`/towns/${townId}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse"><BarChart3 size={28} /></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {existingId ? "評価を修正" : "この町を評価"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            各項目を1〜5で評価してください
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {RATING_CATEGORIES.map((cat) => (
              <div key={cat.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium inline-flex items-center gap-1">
                    {RATING_ICON_MAP[cat.key] ?? cat.icon} {cat.label}
                  </span>
                  <span className="text-lg font-bold text-primary w-8 text-right">
                    {scores[cat.key]}
                  </span>
                </div>
                <Slider
                  value={[scores[cat.key]]}
                  onValueChange={(vals) =>
                    setScores((prev) => ({
                      ...prev,
                      [cat.key]: Array.isArray(vals) ? vals[0] : vals,
                    }))
                  }
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            ))}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={submitting}
            >
              {submitting ? "保存中..." : "評価を保存"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
