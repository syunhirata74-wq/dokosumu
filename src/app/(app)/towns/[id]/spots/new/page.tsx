"use client";
import { toast } from "sonner";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SPOT_CATEGORIES } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewSpotPage() {
  const params = useParams();
  const townId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [memo, setMemo] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let photoUrl: string | null = null;

    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${townId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("spot-photos")
        .upload(path, photoFile);

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("spot-photos").getPublicUrl(path);
        photoUrl = publicUrl;
      }
    }

    const { error } = await supabase.from("spots").insert({
      town_id: townId,
      name,
      category,
      memo: memo || null,
      photo_url: photoUrl,
    });

    if (error) {
      toast.error("登録に失敗しました: " + error.message);
      setSubmitting(false);
      return;
    }

    router.push(`/towns/${townId}`);
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">スポットを追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo */}
            <div className="space-y-2">
              <Label>写真</Label>
              <div
                className="h-40 bg-muted rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed border-muted-foreground/30 active:bg-muted/80"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="preview"
                    className="h-full w-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-3xl mb-1">📷</div>
                    <p className="text-sm text-muted-foreground">
                      タップして撮影・選択
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="spot-name">スポット名 *</Label>
              <Input
                id="spot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: おしゃれなカフェ"
                required
                className="h-12 text-base"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <div className="grid grid-cols-3 gap-2">
                {SPOT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${
                      category === cat.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border"
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label htmlFor="memo">メモ</Label>
              <Textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="気になったポイントなど"
                rows={3}
                className="text-base"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={submitting}
            >
              {submitting ? "追加中..." : "スポットを追加"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
