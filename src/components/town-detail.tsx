"use client";

import { useRef, useState } from "react";
import type { TownProfile } from "@/lib/diagnosis";
import { DialogTitle } from "@/components/ui/dialog";
import {
  X,
  Heart,
  Clock,
  TrainFront,
  Coins,
  Coffee,
  Utensils,
  ShoppingBasket,
  Trees,
  Hospital,
} from "lucide-react";

export function Fact({
  Icon,
  label,
  value,
  unit,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={14} className="text-primary shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</div>
        <div className="text-sm font-semibold leading-none">
          {value}
          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function MetricCell({
  Icon,
  value,
  label,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center bg-muted/40 rounded-xl py-2.5 px-1">
      <Icon size={16} className="text-primary mb-1" />
      <div className="text-sm font-bold leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

/**
 * The fullscreen detail dialog body.
 * If `onDecide` is provided, shows the LIKE/PASS CTA bar at the bottom.
 * If omitted (e.g. viewing a town already in the wishlist), the CTA bar
 * is hidden.
 */
export function TownDetailContent({
  town,
  commuteToWork,
  workplace,
  onClose,
  onDecide,
}: {
  town: TownProfile & { imageUrl?: string };
  commuteToWork: number | null;
  workplace: string | null;
  onClose: () => void;
  onDecide?: (direction: "left" | "right") => void;
}) {
  // Only first 2 photos (station/area); skip facility interior shots (index 2+)
  const photos = (town.photos && town.photos.length > 0
    ? town.photos
    : town.imageUrl
    ? [town.imageUrl]
    : []
  ).slice(0, 2);
  const [heroPhoto, setHeroPhoto] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [pullStart, setPullStart] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      setPullStart(e.touches[0].clientY);
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (pullStart === null) return;
    const dy = e.touches[0].clientY - pullStart;
    if (dy > 0) setPullY(dy);
  }
  function handleTouchEnd() {
    if (pullY > 120) onClose();
    setPullY(0);
    setPullStart(null);
  }

  return (
    <div
      className="flex flex-col h-full bg-background transition-transform"
      style={{ transform: pullY > 0 ? `translateY(${Math.min(pullY, 300)}px)` : undefined }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-2 h-14 bg-background/95 backdrop-blur border-b">
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="w-12 h-12 flex items-center justify-center rounded-full active:bg-muted transition-colors"
        >
          <X size={24} />
        </button>
        <DialogTitle className="text-base font-semibold">{town.name}</DialogTitle>
        <div className="w-12 h-12" />
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto ${onDecide ? "pb-24" : "pb-10"}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {photos.length > 0 && (
          <div className="relative h-64 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[heroPhoto]} alt={town.name} className="w-full h-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  className="absolute inset-y-0 left-0 w-1/3 z-10"
                  onClick={() => setHeroPhoto((i) => (i - 1 + photos.length) % photos.length)}
                  aria-label="前の写真"
                />
                <button
                  className="absolute inset-y-0 right-0 w-1/3 z-10"
                  onClick={() => setHeroPhoto((i) => (i + 1) % photos.length)}
                  aria-label="次の写真"
                />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                  {photos.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === heroPhoto ? "w-6 bg-white" : "w-1.5 bg-white/60"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="px-4 py-4 border-b">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-2xl font-bold">{town.name}</h2>
            <span className="text-sm text-muted-foreground">{town.pref}</span>
          </div>
          {town.lineNames && town.lineNames.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">{town.lineNames.join("・")}</div>
          )}
          <p className="text-sm text-foreground mt-2 leading-relaxed">{town.description}</p>
        </div>

        <div className="px-4 py-5 space-y-6">
          {commuteToWork !== null && workplace && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Clock size={12} /> 通勤時間
              </h3>
              <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm">{workplace} まで</span>
                <span className="text-lg font-bold text-primary">{commuteToWork}分</span>
              </div>
            </section>
          )}

          {town.commuteHubs && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <TrainFront size={12} /> 主要駅までの所要時間
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(["渋谷", "新宿", "東京"] as const).map((hub) =>
                  town.commuteHubs?.[hub] !== undefined ? (
                    <div key={hub} className="bg-muted/40 rounded-lg p-2 text-center">
                      <div className="text-xs text-muted-foreground">{hub}</div>
                      <div className="text-base font-bold">{town.commuteHubs[hub]}分</div>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          )}

          {town.rentRange ? (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Coins size={12} /> 家賃相場（賃貸マンション）
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(["1LDK", "2LDK", "3LDK"] as const).map((madori) =>
                  town.rentRange?.[madori] !== undefined ? (
                    <div key={madori} className="bg-muted/40 rounded-lg p-2 text-center">
                      <div className="text-xs text-muted-foreground">{madori}</div>
                      <div className="text-base font-bold">{(town.rentRange[madori]! / 10000).toFixed(0)}万</div>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          ) : (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Coins size={12} /> 家賃
              </h3>
              <div className="bg-muted/40 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm">2LDK</span>
                <span className="text-lg font-bold">
                  {Math.round((town.rentAvg2LDK ?? town.rent2ldk) / 10000)}万円
                </span>
              </div>
            </section>
          )}

          {!town.commuteHubs && !town.lineNames && (
            <p className="text-[11px] text-center text-muted-foreground bg-muted/30 rounded-lg py-2.5 px-3">
              この駅の詳細情報は現在準備中です
            </p>
          )}

          {town.lineNames && town.lineNames.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <TrainFront size={12} /> 路線（{town.lineNames.length}本）
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {town.lineNames.map((l) => (
                  <span key={l} className="bg-muted text-xs px-2.5 py-1 rounded-full">{l}</span>
                ))}
              </div>
            </section>
          )}

          {town.facilities && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">周辺データ</h3>
              <div className="grid grid-cols-3 gap-2">
                {town.facilities.cafe !== undefined && <Fact Icon={Coffee} label="カフェ" value={town.facilities.cafe} unit="件" />}
                {town.facilities.gourmet !== undefined && <Fact Icon={Utensils} label="グルメ" value={town.facilities.gourmet} unit="件" />}
                {town.facilities.supermarket !== undefined && <Fact Icon={ShoppingBasket} label="スーパー" value={town.facilities.supermarket} unit="件" />}
                {town.facilities.park !== undefined && <Fact Icon={Trees} label="公園" value={town.facilities.park} unit="個" />}
                {town.facilities.hospital !== undefined && <Fact Icon={Hospital} label="病院" value={town.facilities.hospital} unit="件" />}
              </div>
            </section>
          )}
        </div>
      </div>

      {onDecide && (
        <div className="sticky bottom-0 left-0 right-0 z-10 bg-background border-t px-4 py-3 flex gap-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button
            onClick={() => onDecide("left")}
            className="flex-1 h-12 rounded-full border-2 border-gray-300 bg-white font-semibold text-gray-500 active:scale-95 transition-transform flex items-center justify-center gap-1.5"
          >
            <X size={18} />
            後でいいかも
          </button>
          <button
            onClick={() => onDecide("right")}
            className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-semibold active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-md"
          >
            <Heart size={18} fill="currentColor" />
            行ってみたい
          </button>
        </div>
      )}
    </div>
  );
}
