import React from "react";
import { Heart } from "lucide-react";
import { Restaurant } from "../../types";
import { FALLBACK_IMAGE } from "../lib/fallbackImage";

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: () => void;
  onFavorite: () => void;
  visited?: boolean;
  visitCount?: number;
  lastVisited?: string | null;
  onCheckIn?: () => void;
}

const formatLastVisit = (timestamp?: string | null) => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export const RestaurantCard = ({
  restaurant,
  onClick,
  onFavorite,
  visited = false,
  visitCount,
  lastVisited,
  onCheckIn,
}: RestaurantCardProps) => {
  const { imageUrl, name, rating, reviewCount, address, priceLevel, types, isFavorite, businessStatus, openNow, dietary } =
    restaurant;
  const { reasons, matchScore } = restaurant;
  const resolvedImageUrl = imageUrl || FALLBACK_IMAGE;
  const formattedVisitDate = formatLastVisit(lastVisited);
  const scoreBadge =
    typeof matchScore === "number" ? (
      <span className="absolute left-2 top-2 rounded-full bg-emerald-600/95 px-2 py-0.5 text-xs font-semibold text-white shadow">
        {matchScore}% match
      </span>
    ) : null;

  return (
    <div
      className="relative overflow-hidden rounded-lg shadow cursor-pointer bg-white dark:bg-gray-900 border border-transparent dark:border-gray-800 transition-colors duration-300"
      onClick={onClick}
      tabIndex={0}
      role="button"
    >
      <div className="relative">
        <img
          src={resolvedImageUrl}
          alt={name}
          className="object-cover w-full h-48"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src !== FALLBACK_IMAGE) {
              target.src = FALLBACK_IMAGE;
            }
          }}
        />
        {scoreBadge}

        {businessStatus !== "OPERATIONAL" && (
          <div className="absolute px-2 py-1 text-xs font-medium text-white bg-red-500 rounded top-2 left-2">
            Closed
          </div>
        )}

        <button
          className="absolute flex items-center justify-center w-8 h-8 transition rounded-full bg-white/70 hover:bg-white dark:bg-gray-900/80 dark:hover:bg-gray-900 top-2 right-2"
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          aria-label={isFavorite ? "Unsave" : "Save"}
          type="button"
        >
          <Heart
            size={22}
            strokeWidth={2}
            className={isFavorite ? "text-red-500 fill-red-500" : "text-gray-300"}
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="p-4 text-gray-900 dark:text-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{name}</h3>
          {priceLevel !== null && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{"$".repeat(priceLevel)}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {types?.map((type, index) => (
            <span key={index} className="text-sm text-gray-600 dark:text-gray-300 capitalize">
              {type.replace(/_/g, " ")}
              {index < types.length - 1 && " • "}
            </span>
          ))}
        </div>

        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{address}</p>

        {/* OpenStreetMap carries no ratings, so show what it does know
            rather than a hollow "0 (0 reviews)". */}
        {rating > 0 ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-yellow-500">★</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{rating}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">({reviewCount} reviews)</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {openNow === true && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Open now</span>
            )}
            {openNow === false && (
              <span className="font-medium text-gray-500 dark:text-gray-400">Closed</span>
            )}
            {dietary?.slice(0, 2).map((diet) => (
              <span key={diet} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {diet.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Why this made the shortlist. Shown for /decide results only, and it
            distinguishes what we know from what OSM never recorded — an
            "unknown" chip is not a negative, and pretending otherwise is how a
            recommender starts lying. */}
        {reasons?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reasons.map((reason, i) => (
              <span
                key={`${reason.label}-${i}`}
                className={
                  "rounded-full px-2 py-0.5 text-xs font-medium " +
                  (reason.kind === "match" || reason.kind === "bonus"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : reason.kind === "unknown"
                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300")
                }
              >
                {reason.kind === "unknown" ? "? " : ""}
                {reason.label}
              </span>
            ))}
          </div>
        ) : null}

        {(onCheckIn || visited) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onCheckIn && (
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  visited
                    ? "border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCheckIn();
                }}
              >
                {visited ? "Check in again" : "Been here"}
              </button>
            )}
            {visited && (
              <span className="text-xs font-medium text-emerald-600">
                {visitCount ? `${visitCount} visit${visitCount > 1 ? "s" : ""}` : "Visited"}
                {formattedVisitDate ? ` · ${formattedVisitDate}` : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
