"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Clock, MapPin, Users, BarChart3, Layers } from "lucide-react";

export default function DiagnosisPage() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 gap-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center space-y-6">
          <Sparkles size={48} className="mx-auto text-primary" />
          <h1 className="text-2xl font-bold">住みたい町診断</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            8つの質問に答えるだけで
            <br />
            二人にぴったりの町が見つかる
          </p>

          <div className="bg-muted rounded-xl p-4 space-y-2 text-left">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="text-muted-foreground" />
              <span>所要時間: 約2分</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-muted-foreground" />
              <span>対象エリア: 一都三県+関西</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users size={14} className="text-muted-foreground" />
              <span>二人で回答すると相性もわかる</span>
            </div>
          </div>

          <Button
            onClick={() => router.push("/diagnosis/quiz")}
            className="w-full h-14 text-lg font-bold"
          >
            診断スタート
          </Button>
        </CardContent>
      </Card>

      <button
        onClick={() => router.push("/diagnosis/swipe")}
        className="w-full max-w-sm bg-white/80 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
      >
        <Layers size={24} className="text-primary" />
        <div className="text-left flex-1">
          <p className="font-bold text-sm">町スワイプ</p>
          <p className="text-xs text-muted-foreground">直感で「住みたい/パス」を選んで好みを分析</p>
        </div>
        <span className="text-muted-foreground text-sm">→</span>
      </button>

      <button
        onClick={() => router.push("/diagnosis/values")}
        className="w-full max-w-sm bg-white/80 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
      >
        <BarChart3 size={24} className="text-primary" />
        <div className="text-left flex-1">
          <p className="font-bold text-sm">ふたりの価値観マップ</p>
          <p className="text-xs text-muted-foreground">評価データから二人のズレを可視化</p>
        </div>
        <span className="text-muted-foreground text-sm">→</span>
      </button>
    </div>
  );
}
