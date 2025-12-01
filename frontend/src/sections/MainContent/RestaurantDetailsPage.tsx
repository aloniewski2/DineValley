import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Restaurant, RestaurantDetails, VisitStatsEntry } from "../../../types";
import { Heart, Globe, Phone, Navigation, MapPin, CheckCircle2, Sparkles } from "lucide-react";
import { StatusBanner } from "../../components/StatusBanner";
import { askAssistant, ComparisonResult, RestaurantContextPayload } from "../../api/assistant";

export interface RestaurantDetailsPageProps {
  restaurantId: string;
  fallbackRestaurant?: Restaurant | null;
  details: RestaurantDetails | null;
  loading: boolean;
  error?: string | null;
  onBack: () => void;
  onToggleFavorite: (id: string) => void;
  onCheckIn: (restaurant: Restaurant) => void;
  visitInfo?: VisitStatsEntry;
  comparisonPool?: Restaurant[];
}

export const RestaurantDetailsPage: React.FC<RestaurantDetailsPageProps> = ({
  restaurantId,
  fallbackRestaurant,
  details,
  loading,
  error,
  onBack,
  onToggleFavorite,
  onCheckIn,
  visitInfo,
  comparisonPool,
}) => {
  const display = useMemo(() => {
    if (details) {
      return {
        id: details.id,
        name: details.name,
        rating: details.rating ?? fallbackRestaurant?.rating ?? 0,
        reviewCount: fallbackRestaurant?.reviewCount ?? 0,
        address: details.address || fallbackRestaurant?.address || "",
        priceLevel: fallbackRestaurant?.priceLevel ?? null,
        types: fallbackRestaurant?.types ?? [],
        imageUrl: details.imageUrl,
        isFavorite: fallbackRestaurant?.isFavorite ?? false,
      };
    }

    if (fallbackRestaurant) {
      return {
        id: fallbackRestaurant.id,
        name: fallbackRestaurant.name,
        rating: fallbackRestaurant.rating,
        reviewCount: fallbackRestaurant.reviewCount,
        address: fallbackRestaurant.address,
        priceLevel: fallbackRestaurant.priceLevel,
        types: fallbackRestaurant.types,
        imageUrl: fallbackRestaurant.imageUrl,
        isFavorite: fallbackRestaurant.isFavorite ?? false,
      };
    }

    return null;
  }, [details, fallbackRestaurant, restaurantId]);

  const formattedTypes = useMemo(() => {
    const typeDescriptions: Record<string, string> = {
      point_of_interest: "Local highlight",
      establishment: "Neighborhood favorite",
      food: "Great for food lovers",
      restaurant: "Sit‑down dining",
      bar: "Cocktails & nightcaps",
      cafe: "Casual coffee spot",
      bakery: "Freshly baked treats",
    };

    const typesSource = details?.types && details.types.length > 0 ? details.types : display?.types ?? [];

    return typesSource
      .filter((type) => type !== "food")
      .slice(0, 3)
      .map((type) => typeDescriptions[type] ?? type.replace(/_/g, " "));
  }, [details?.types, display?.types]);

  const photoSources = useMemo(() => {
    if (details?.photoUrls?.length) {
      return details.photoUrls;
    }
    return display?.imageUrl ? [display.imageUrl] : [];
  }, [details?.photoUrls, display?.imageUrl]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const menuUrl = details?.website ?? null;

  const displayAsRestaurant = useMemo(() => {
    if (!display) return null;
    return {
      id: display.id,
      name: display.name,
      imageUrl: display.imageUrl || fallbackRestaurant?.imageUrl || "",
      rating: display.rating,
      reviewCount: display.reviewCount,
      address: display.address,
      priceLevel: display.priceLevel,
      businessStatus: fallbackRestaurant?.businessStatus ?? "UNKNOWN",
      types: details?.types ?? fallbackRestaurant?.types ?? [],
      dietary: fallbackRestaurant?.dietary ?? [],
      isFavorite: display.isFavorite,
    } as Restaurant;
  }, [details?.types, display, fallbackRestaurant]);

  const [comparisonSelection, setComparisonSelection] = useState<string[]>(
    display?.id ? [display.id] : []
  );
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonEvidence, setComparisonEvidence] = useState<Record<string, string>>({});

  useEffect(() => {
    setComparisonSelection(display?.id ? [display.id] : []);
    setComparisonResult(null);
    setComparisonError(null);
  }, [display?.id]);

  const comparisonCandidates = useMemo(() => {
    if (!comparisonPool?.length) return [] as Restaurant[];
    const map = new Map<string, Restaurant>();
    comparisonPool.forEach((restaurant) => {
      if (!restaurant?.id || restaurant.id === display?.id) return;
      if (!map.has(restaurant.id)) {
        map.set(restaurant.id, restaurant);
      }
    });
    return Array.from(map.values()).slice(0, 12);
  }, [comparisonPool, display?.id]);

  const resolveRestaurantById = useCallback(
    (id: string): Restaurant | null => {
      if (displayAsRestaurant && displayAsRestaurant.id === id) {
        return displayAsRestaurant;
      }
      return comparisonPool?.find((restaurant) => restaurant.id === id) ?? null;
    },
    [comparisonPool, displayAsRestaurant]
  );

  const toggleComparisonSelection = (id: string) => {
    setComparisonSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((value) => value !== id);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparisonLimitReached = comparisonSelection.length >= 5;

  const toContextPayload = (restaurant: Restaurant): RestaurantContextPayload => ({
    id: restaurant.id,
    name: restaurant.name,
    rating: restaurant.rating,
    reviewCount: restaurant.reviewCount,
    address: restaurant.address,
    priceLevel: restaurant.priceLevel,
    types: Array.isArray(restaurant.types) ? restaurant.types.slice(0, 6) : [],
    dietary: restaurant.dietary,
    isFavorite: Boolean(restaurant.isFavorite),
    imageUrl: restaurant.imageUrl,
  });

  const formatPrice = (price?: number | null) => {
    if (!Number.isFinite(price) || !price) return "?";
    return "$".repeat(Math.min(Math.max(1, Math.round(price)), 4));
  };

  const formatTypes = (restaurant: Restaurant) =>
    (restaurant.types ?? [])
      .filter((type) => type !== "food")
      .slice(0, 3)
      .map((type) => type.replace(/_/g, " "))
      .join(", ");

  const buildComparisonPrompt = (restaurants: Restaurant[]): string => {
    return restaurants
      .map((restaurant, index) => {
        const typeText = formatTypes(restaurant);
        const dietaryText = (restaurant.dietary ?? []).slice(0, 2).join(", ");
        const priceSymbol = formatPrice(restaurant.priceLevel);
        return `${index + 1}. ${restaurant.name} — Rating ${restaurant.rating ?? "N/A"} (${restaurant.reviewCount ?? 0} reviews), Price ${priceSymbol}, Tags: ${[
          typeText,
          dietaryText,
        ]
          .filter(Boolean)
          .join(" • ")}`;
      })
      .join("\n");
  };

  const computeComparisonSignals = (restaurants: Restaurant[]) => {
    const insights: Record<string, string> = {};

    const valueScores = restaurants.map((restaurant) => {
      const price = Number.isFinite(restaurant.priceLevel) && restaurant.priceLevel ? restaurant.priceLevel : 2.5;
      const rating = Number.isFinite(restaurant.rating) ? restaurant.rating : 0;
      const score = price > 0 ? rating / price : rating;
      return { restaurant, score, evidence: `Value score ${(score || 0).toFixed(2)} (rating ${rating || "?"}, price ${formatPrice(restaurant.priceLevel)})` };
    });

    const dietaryScores = restaurants.map((restaurant) => {
      const count = Array.isArray(restaurant.dietary) ? restaurant.dietary.length : 0;
      const score = count + (Number.isFinite(restaurant.rating) ? restaurant.rating / 10 : 0);
      return { restaurant, score, evidence: `${count} dietary tags${Number.isFinite(restaurant.rating) ? `, rating ${restaurant.rating?.toFixed?.(1) ?? restaurant.rating}` : ""}` };
    });

    const groupScores = restaurants.map((restaurant) => {
      const types = (restaurant.types ?? []).map((type) => type.toLowerCase());
      const groupFriendly = types.some((type) => ["bar", "restaurant", "cafe", "meal_takeaway"].includes(type));
      const rating = Number.isFinite(restaurant.rating) ? restaurant.rating : 0;
      const score = (groupFriendly ? 1 : 0) + rating;
      return { restaurant, score, evidence: `${groupFriendly ? "Group-friendly tags" : "Few group tags"}, rating ${rating.toFixed(1)}` };
    });

    const quickScores = restaurants.map((restaurant) => {
      const types = (restaurant.types ?? []).map((type) => type.toLowerCase());
      const quick = types.some((type) => ["meal_takeaway", "meal_delivery", "meal_takeout", "fast_food"].includes(type));
      const rating = Number.isFinite(restaurant.rating) ? restaurant.rating : 0;
      const score = (quick ? 1.5 : 0) + rating / 2;
      return { restaurant, score, evidence: `${quick ? "Has takeout/delivery tags" : "No speed tags"}, rating ${rating.toFixed(1)}` };
    });

    const popularSignals = restaurants.map((restaurant) => {
      const revCount = Number.isFinite(restaurant.reviewCount) ? restaurant.reviewCount : 0;
      const rating = Number.isFinite(restaurant.rating) ? restaurant.rating : 0;
      return { restaurant, score: revCount + rating, evidence: `${revCount} reviews, rating ${rating.toFixed(1)}` };
    });

    const pickWinner = (category: string, scores: Array<{ restaurant: Restaurant; score: number; evidence: string }>) => {
      const sorted = [...scores].sort((a, b) => b.score - a.score);
      if (!sorted.length) {
        insights[category] = "Not enough data to choose.";
        return;
      }
      const [top, second] = sorted;
      const tie = second && Math.abs(top.score - second.score) < 0.05;
      insights[category] = tie
        ? `Split decision between ${top.restaurant.name}${second ? ` and ${second.restaurant.name}` : ""} — scores are too close.`
        : `${top.restaurant.name}: ${top.evidence}`;
    };

    pickWinner("Best value", valueScores);
    pickWinner("Most options for dietary needs", dietaryScores);
    pickWinner("Best for groups", groupScores);
    pickWinner("Best for quick service", quickScores);
    pickWinner("Most popular dishes", popularSignals);

    const summary = restaurants
      .map((restaurant) => {
        const price = formatPrice(restaurant.priceLevel);
        return `${restaurant.name}: rating ${restaurant.rating ?? "?"} (${restaurant.reviewCount ?? 0} reviews), price ${price}, tags ${formatTypes(restaurant) || "n/a"}, dietary ${(restaurant.dietary ?? []).join(", ") || "n/a"}`;
      })
      .join("\n");

    const hints = [
      "Precomputed hints (use as evidence, do not invent):",
      `Best value hint: ${insights["Best value"] ?? "n/a"}`,
      `Dietary hint: ${insights["Most options for dietary needs"] ?? "n/a"}`,
      `Groups hint: ${insights["Best for groups"] ?? "n/a"}`,
      `Quick service hint: ${insights["Best for quick service"] ?? "n/a"}`,
      `Popular dishes hint: ${insights["Most popular dishes"] ?? "n/a"}`,
    ].join("\n");

    return { summary, hints, insights };
  };

  const handleRunComparison = useCallback(async () => {
    const selected = comparisonSelection
      .map((id) => resolveRestaurantById(id))
      .filter((value): value is Restaurant => Boolean(value))
      .slice(0, 5);

    if (selected.length < 2) {
      setComparisonError("Select at least two restaurants to compare.");
      return;
    }

    setComparisonLoading(true);
    setComparisonError(null);
    setComparisonResult(null);
    setComparisonEvidence({});

    try {
      const signals = computeComparisonSignals(selected);
      const prompt = [
        "Compare these restaurants across value, dietary breadth, group friendliness, popular dishes, and speed. Base everything on the provided context.",
        buildComparisonPrompt(selected),
        signals.hints,
        "If data is thin for a category, return Split decision with a brief reason.",
      ].join("\n");
      const contextPayload = selected.map(toContextPayload);
      const response = await askAssistant(prompt, [], contextPayload, undefined, { useCase: "comparison_tool" });
      if (response.comparison) {
        setComparisonResult(response.comparison);
        setComparisonEvidence(signals.insights);
      } else {
        setComparisonError("The comparison tool could not find enough info. Try selecting different restaurants.");
      }
    } catch (comparisonErr) {
      console.error("Comparison request failed", comparisonErr);
      setComparisonError(
        comparisonErr instanceof Error ? comparisonErr.message : "Unable to compare right now. Please try again."
      );
    } finally {
      setComparisonLoading(false);
    }
  }, [comparisonSelection, resolveRestaurantById]);


  useEffect(() => {
    setPhotoIndex(0);
  }, [restaurantId, photoSources.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleOpenMenu = useCallback(() => {
    if (!menuUrl) return;
    const win = window.open(menuUrl, "_blank", "noopener,noreferrer");
    win?.focus?.();
  }, [menuUrl]);

  const totalPhotos = photoSources.length;
  const hasMultiplePhotos = totalPhotos > 1;
  const currentPhoto = photoSources[photoIndex] ?? display?.imageUrl ?? "https://source.unsplash.com/600x400/?restaurant";

  const showPrevPhoto = () => {
    if (!hasMultiplePhotos) return;
    setPhotoIndex((prev) => (prev - 1 + totalPhotos) % totalPhotos);
  };

  const showNextPhoto = () => {
    if (!hasMultiplePhotos) return;
    setPhotoIndex((prev) => (prev + 1) % totalPhotos);
  };

  if (!display) {
    return (
      <div className="p-6 overflow-y-auto">
        <button
          className="text-gray-600 hover:text-gray-900 mb-4"
          onClick={onBack}
        >
          ← Back
        </button>
        <p className="text-gray-500">Restaurant information is unavailable.</p>
      </div>
    );
  }

  const showSkeleton = loading && !details;

  const handleCheckIn = useCallback(() => {
    if (!display) return;
    const payload: Restaurant = {
      id: display.id,
      name: display.name,
      imageUrl: display.imageUrl || fallbackRestaurant?.imageUrl || "https://source.unsplash.com/400x300/?restaurant,food",
      rating: display.rating,
      reviewCount: display.reviewCount,
      address: display.address,
      priceLevel: display.priceLevel,
      businessStatus: fallbackRestaurant?.businessStatus ?? "UNKNOWN",
      types: details?.types ?? fallbackRestaurant?.types ?? [],
    };
    onCheckIn(payload);
  }, [details?.types, display, fallbackRestaurant, onCheckIn]);

  const mapLink = useMemo(() => {
    if (details?.googleMapsUrl) return details.googleMapsUrl;
    if (details?.coordinates) {
      const { lat, lng } = details.coordinates;
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return null;
  }, [details?.googleMapsUrl, details?.coordinates]);

  const actionButtons = useMemo(() => {
    const buttons: Array<{ label: string; href: string; icon: React.ReactNode } | null> = [
      details?.phone ? { label: "Call", href: `tel:${details.phone}`, icon: <Phone size={18} /> } : null,
      details?.website ? { label: "Visit Website", href: details.website, icon: <Globe size={18} /> } : null,
      mapLink ? { label: "Get Directions", href: mapLink, icon: <Navigation size={18} /> } : null,
    ];
    return buttons.filter(Boolean) as Array<{ label: string; href: string; icon: React.ReactNode }>;
  }, [details?.phone, details?.website, mapLink]);

  const reviewSummary = details?.reviewSummary;
  const topReview = details?.reviews?.[0];

  return (
    <div className="p-6 overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-full transition-colors duration-300">
      {isOffline && (
        <StatusBanner
          variant="warning"
          message="You’re offline. Some live details may be unavailable until you reconnect."
        />
      )}
      {error && !loading && (
        <StatusBanner
          variant="error"
          message={error}
          onRetry={() => window.location.reload()}
        />
      )}
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-start md:justify-between">
        <button className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" onClick={onBack}>
          ← Back
        </button>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {visitInfo && (
            <div className="text-right sm:text-left">
              <p className="flex items-center justify-end gap-1 text-xs font-semibold text-emerald-600 sm:justify-start">
                <CheckCircle2 size={14} />
                {visitInfo.count} visit{visitInfo.count > 1 ? "s" : ""} logged
              </p>
              <p className="text-xs text-gray-500">
                Last visit {new Date(visitInfo.lastVisited).toLocaleDateString()}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
              type="button"
              onClick={handleCheckIn}
            >
              Been here
            </button>
            <button
              className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-100"
              onClick={() => onToggleFavorite(display.id)}
            >
              <Heart
                size={20}
                className={display.isFavorite ? "text-red-500 fill-red-500" : "text-gray-400"}
                fill={display.isFavorite ? "currentColor" : "none"}
              />
              {display.isFavorite ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Restaurant Image */}
      <div className="relative mb-6 rounded-lg overflow-hidden bg-gray-100" aria-busy={showSkeleton}
        aria-live={showSkeleton ? "polite" : undefined}>
        {showSkeleton ? (
          <div className="h-[320px] w-full animate-pulse bg-gray-200" />
        ) : (
          <>
            <img
              src={currentPhoto}
              alt={display.name}
              className="w-full md:h-[380px] max-h-[420px] object-contain md:object-cover"
            />
            {hasMultiplePhotos && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black"
                  onClick={showPrevPhoto}
                  aria-label="Previous photo"
                  type="button"
                >
                  ‹
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black"
                  onClick={showNextPhoto}
                  aria-label="Next photo"
                  type="button"
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                  Photo {photoIndex + 1} of {totalPhotos}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <h1 className="text-2xl font-bold mb-2">{display.name}</h1>
      {loading && !details && (
        <div className="mb-4 space-y-2">
          <div className="h-3 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
        </div>
      )}
      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 mb-4">
        <span>
          ⭐ {display.rating ?? "-"} ({display.reviewCount} reviews)
        </span>
        {display.priceLevel !== null && display.priceLevel !== undefined && (
          <span>{"$".repeat(display.priceLevel)}</span>
        )}
        {formattedTypes.length > 0 && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {formattedTypes.join(", ")}
          </span>
        )}
      </div>

      {(actionButtons.length > 0 || menuUrl) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {menuUrl && (
            <button
              type="button"
              onClick={handleOpenMenu}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-300"
            >
              <Globe size={18} />
              View Menu
            </button>
          )}
          {actionButtons.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-300"
              aria-label={label}
            >
              {icon}
              {label}
            </a>
          ))}
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 transition-colors duration-300">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Instant comparison tool</p>
            <h2 className="font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Sparkles size={16} className="text-indigo-500" /> Decide faster
            </h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {comparisonSelection.length}/5 selected
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Choose up to four more restaurants to see who wins categories like value, dietary options, group-friendly vibes, popular dishes, and quick service.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {comparisonSelection.map((id) => {
            const restaurant = resolveRestaurantById(id);
            if (!restaurant) return null;
            return (
              <span
                key={id}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {restaurant.name}
              </span>
            );
          })}
        </div>
        {comparisonCandidates.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Add restaurants to compare:</p>
            <div className="flex flex-wrap gap-2">
              {comparisonCandidates.map((candidate) => {
                const checked = comparisonSelection.includes(candidate.id);
                const disabled = !checked && comparisonLimitReached;
                return (
                  <label
                    key={candidate.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                      checked
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-600/30 dark:text-indigo-100"
                        : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleComparisonSelection(candidate.id)}
                    />
                    {candidate.name}
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Save or view a few more restaurants to unlock comparisons.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRunComparison}
            disabled={comparisonSelection.length < 2 || comparisonLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {comparisonLoading ? "Comparing..." : "Compare now"}
          </button>
          {comparisonSelection.length < 2 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Pick at least two restaurants.</p>
          )}
          {comparisonError && <p className="text-xs text-red-500">{comparisonError}</p>}
        </div>
        {comparisonResult && (
          <div className="mt-4 space-y-3">
            {comparisonResult.overview && (
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{comparisonResult.overview}</p>
            )}
            {comparisonResult.insights?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {comparisonResult.insights.map((insight) => (
                  <div
                    key={`${insight.category}-${insight.winner}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{insight.category}</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{insight.winner}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{insight.rationale}</p>
                    {comparisonEvidence[insight.category] && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Evidence: {comparisonEvidence[insight.category]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">No insights returned.</p>
            )}
          </div>
        )}
      </div>

      {/* About Section */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 transition-colors duration-300">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">About</h2>
        {showSkeleton ? (
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {details?.openingHours?.length
              ? `Open today: ${details.openingHours[0]}`
              : "Detailed description is coming soon."}
          </p>
        )}
      </div>

      {/* Contact Section */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 transition-colors duration-300">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Contact &amp; Hours</h2>
        {showSkeleton ? (
          <div className="space-y-2">
            <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-800 dark:text-gray-200">📍 {display.address}</p>
            {details?.phone && <p className="text-sm text-gray-800 dark:text-gray-200">📞 {details.phone}</p>}
            {details?.website && (
              <p className="text-sm text-gray-800 dark:text-gray-200">
                🌐 <a href={details.website} className="text-blue-600 underline dark:text-blue-400" target="_blank" rel="noreferrer">Visit Website</a>
              </p>
            )}
            {details?.openingHours?.length ? (
              <ul className="mt-2 space-y-1">
                {details.openingHours.map((entry, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-300">
                    {entry}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Hours unavailable.</p>
            )}
          </>
        )}
      </div>

      {details?.mapImageUrl && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 transition-colors duration-300">
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Where you'll find it</h2>
          <div className="relative">
            <img
              src={details.mapImageUrl}
              alt={`Map of ${display.name}`}
              className="w-full rounded-lg border"
            />
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white"
              >
                <MapPin size={16} />
                Open in Maps
              </a>
            )}
          </div>
        </div>
      )}

      {reviewSummary && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 transition-colors duration-300">
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Review Highlights</h2>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {reviewSummary.average ? reviewSummary.average.toFixed(1) : "-"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Based on {reviewSummary.total} Google reviews
              </p>
            </div>
            {topReview && (
              <div className="rounded-lg bg-white dark:bg-gray-900 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{topReview.authorName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{topReview.relativeTimeDescription}</p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                  {topReview.text.length > 280
                    ? `${topReview.text.slice(0, 277)}...`
                    : topReview.text}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 transition-colors duration-300">
        <h2 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Recent Reviews</h2>
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading reviews...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && details?.reviews?.length ? (
          <div className="space-y-4">
            {details.reviews.slice(0, 5).map((review, idx) => (
              <div key={idx} className="rounded-lg bg-white dark:bg-gray-900 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  {review.profilePhotoUrl && (
                    <img
                      src={review.profilePhotoUrl}
                      alt={review.authorName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{review.authorName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{review.relativeTimeDescription}</p>
                  </div>
                  <span className="ml-auto text-sm text-yellow-400">⭐ {review.rating}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{review.text}</p>
              </div>
            ))}
          </div>
        ) : (
          !loading &&
          !error && <p className="text-sm text-gray-500 dark:text-gray-400">No reviews available yet.</p>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-center">
        <button
          className="px-6 py-2 bg-black text-white rounded-lg"
          onClick={() => onToggleFavorite(display.id)}
        >
          {display.isFavorite ? "Remove from Favorites" : "Save Restaurant"}
        </button>
      </div>

    </div>
  );
};
