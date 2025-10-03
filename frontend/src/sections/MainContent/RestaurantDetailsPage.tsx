import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog } from "@headlessui/react";
import { Restaurant, RestaurantDetails } from "../../../types";
import { Heart, Globe, Phone, Navigation, MapPin } from "lucide-react";
import { StatusBanner } from "../../components/StatusBanner";

export interface RestaurantDetailsPageProps {
  restaurantId: string;
  fallbackRestaurant?: Restaurant | null;
  details: RestaurantDetails | null;
  loading: boolean;
  error?: string | null;
  onBack: () => void;
  onToggleFavorite: (id: string) => void;
}

export const RestaurantDetailsPage: React.FC<RestaurantDetailsPageProps> = ({
  restaurantId,
  fallbackRestaurant,
  details,
  loading,
  error,
  onBack,
  onToggleFavorite,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const menuUrl = details?.website ?? null;

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
    if (!win) {
      setPopupBlocked(true);
    } else {
      setPopupBlocked(false);
      win.focus?.();
    }
    setMenuOpen(true);
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
    <div className="p-6 overflow-y-auto">
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
      <div className="flex items-start justify-between mb-4">
        <button
          className="text-gray-600 hover:text-gray-900"
          onClick={onBack}
        >
          ← Back
        </button>
        <button
          className="flex items-center gap-1 text-sm"
          onClick={() => onToggleFavorite(display.id)}
        >
          <Heart
            size={20}
            className={
              display.isFavorite
                ? "text-red-500 fill-red-500"
                : "text-gray-400"
            }
          />
          {display.isFavorite ? "Saved" : "Save"}
        </button>
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
      <div className="flex items-center gap-3 text-sm text-gray-600 mb-4">
        <span>
          ⭐ {display.rating ?? "-"} ({display.reviewCount} reviews)
        </span>
        {display.priceLevel !== null && display.priceLevel !== undefined && (
          <span>{"$".repeat(display.priceLevel)}</span>
        )}
        {formattedTypes.length > 0 && (
          <span className="text-sm text-gray-600">
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
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
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
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
              aria-label={label}
            >
              {icon}
              {label}
            </a>
          ))}
        </div>
      )}

      {/* About Section */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold mb-2">About</h2>
        {showSkeleton ? (
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            {details?.openingHours?.length
              ? `Open today: ${details.openingHours[0]}`
              : "Detailed description is coming soon."}
          </p>
        )}
      </div>

      {/* Contact Section */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold mb-2">Contact & Hours</h2>
        {showSkeleton ? (
          <div className="space-y-2">
            <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-sm">📍 {display.address}</p>
            {details?.phone && <p className="text-sm">📞 {details.phone}</p>}
            {details?.website && (
              <p className="text-sm">
                🌐 <a href={details.website} className="text-blue-600 underline" target="_blank" rel="noreferrer">Visit Website</a>
              </p>
            )}
            {details?.openingHours?.length ? (
              <ul className="mt-2 space-y-1">
                {details.openingHours.map((entry, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    {entry}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Hours unavailable.</p>
            )}
          </>
        )}
      </div>

      {details?.mapImageUrl && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-2">Where you'll find it</h2>
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
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-2">Review Highlights</h2>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {reviewSummary.average ? reviewSummary.average.toFixed(1) : "-"}
              </p>
              <p className="text-sm text-gray-600">
                Based on {reviewSummary.total} Google reviews
              </p>
            </div>
            {topReview && (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="font-semibold text-sm">{topReview.authorName}</p>
                <p className="text-xs text-gray-500">{topReview.relativeTimeDescription}</p>
                <p className="mt-2 text-sm text-gray-700">
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
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold mb-3">Recent Reviews</h2>
        {loading && <p className="text-sm text-gray-500">Loading reviews...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && details?.reviews?.length ? (
          <div className="space-y-4">
            {details.reviews.slice(0, 5).map((review, idx) => (
              <div key={idx} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  {review.profilePhotoUrl && (
                    <img
                      src={review.profilePhotoUrl}
                      alt={review.authorName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{review.authorName}</p>
                    <p className="text-xs text-gray-500">{review.relativeTimeDescription}</p>
                  </div>
                  <span className="ml-auto text-sm text-yellow-500">⭐ {review.rating}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{review.text}</p>
              </div>
            ))}
          </div>
        ) : (!loading && !error && (
          <p className="text-sm text-gray-500">No reviews available yet.</p>
        ))}
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

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} className="fixed inset-0 z-[70] overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">Menu</h3>
                <p className="text-sm text-gray-500">{display.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              {menuUrl ? (
                <div className="space-y-4">
                  <StatusBanner
                    variant="info"
                    message="We opened the menu in a new browser tab so you can view the latest offerings."
                  />
                  {popupBlocked && (
                    <StatusBanner
                      variant="warning"
                      message="Your browser blocked the menu popup. Use the button below or allow popups to open it automatically."
                      onRetry={handleOpenMenu}
                      actionLabel="Open Menu"
                    />
                  )}
                  <a
                    href={menuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                  >
                    Open Menu in New Tab
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Menu information isn’t available yet. Try calling the restaurant for today’s offerings.
                </p>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
