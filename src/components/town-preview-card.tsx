"use client";

import { useState } from "react";
import type { TownProfile } from "@/lib/diagnosis";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TownDetailContent, MetricCell } from "@/components/town-detail";
import { ChevronUp, Clock, Coins, TrainFront, MapPin } from "lucide-react";

/**
 * Compact town preview card: photo + 3 metrics + "詳細を見る" button.
 * Used on /towns/new (manual registration preview) and /matches
 * (wishlist/visited list). No swipe gestures, no LIKE/PASS CTA.
 */
export function TownPreviewCard({ town, footerSlot }: { town: TownProfile; footerSlot?: React.ReactNode }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const photos = (town.photos && town.photos.length > 0
    ? town.photos
    : town.imageUrl
    ? [town.imageUrl]
    : []
  ).slice(0, 2);
  const active = photos[photoIndex] ?? photos[0];

  // Shortest hub among 東京/渋谷/新宿
  const hubs = town.commuteHubs;
  let bestHub: "東京" | "渋谷" | "新宿" | null = null;
  let bestMins = Infinity;
  if (hubs) {
    for (const h of ["東京", "渋谷", "新宿"] as const) {
      const m = hubs[h];
      if (m !== undefined && m < bestMins) {
        bestMins = m;
        bestHub = h;
      }
    }
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden border bg-card shadow-sm">
        <div className="relative h-56 bg-gradient-to-br from-emerald-200 to-emerald-100">
          {active && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active} alt={town.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {photos.length > 1 && (
            <>
              <button
                className="absolute inset-y-0 left-0 w-1/3 z-10"
                onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                aria-label="前の写真"
              />
              <button
                className="absolute inset-y-0 right-0 w-1/3 z-10"
                onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                aria-label="次の写真"
              />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                {photos.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all ${i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
                ))}
              </div>
            </>
          )}
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="text-2xl font-bold drop-shadow-lg leading-tight">{town.name}</h2>
            <div className="flex items-center gap-1 text-sm opacity-90 mt-0.5">
              <MapPin size={14} />
              <span>{town.pref}</span>
              {town.lineNames && town.lineNames.length > 0 && (
                <span className="opacity-70">
                  ・{town.lineNames.slice(0, 2).join("・")}
                  {town.lineNames.length > 2 ? " ほか" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{town.description}</p>

          <div className="grid grid-cols-3 gap-2">
            <MetricCell
              Icon={Clock}
              value={bestHub ? `${bestMins}分` : "—"}
              label={bestHub ? `${bestHub}まで` : "主要駅まで"}
            />
            <MetricCell
              Icon={Coins}
              value={`${Math.round((town.rentAvg2LDK ?? town.rent2ldk) / 10000)}万`}
              label="2LDK家賃"
            />
            <MetricCell
              Icon={TrainFront}
              value={town.lines ? `${town.lines}本` : "—"}
              label="路線"
            />
          </div>

          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="w-full h-11 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full border-2 border-primary bg-primary/5 text-primary active:scale-[0.98] active:bg-primary/10 transition-all"
          >
            <ChevronUp size={16} />
            詳細を見る
          </button>
          {footerSlot}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent fullscreen showCloseButton={false}>
          <TownDetailContent
            town={town}
            commuteToWork={null}
            workplace={null}
            onClose={() => setDetailOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
