import React, { useCallback, useEffect, useState } from "react";
import { Restaurant, VisitStatsMap } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";
import { decideRestaurants, DecideParams } from "../../api/restaurants";

/* The decision screen.
 *
 * This replaces "Trending Restaurants", which ranked nothing: OpenStreetMap
 * carries no ratings or review counts, so every result came back with rating 0
 * and the heading was writing a cheque the data could not cash.
 *
 * What the data *can* support is a constraint problem. Distance, venue kind,
 * cuisine and chain-vs-independent are on essentially every record, so they
 * filter. Hours, price and dietary tags are on a quarter, a third and one
 * percent respectively, so they rank and are labelled — never excluded. The
 * answer is a shortlist with its reasoning attached rather than a thousand
 * rows sorted by nothing. */

type Props = {
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  onCheckIn: (restaurant: Restaurant) => void;
  visitStats: VisitStatsMap;
};

const KINDS = [
  { id: "restaurant", label: "Sit down" },
  { id: "fast_food", label: "Fast food" },
  { id: "cafe", label: "Café" },
  { id: "bar", label: "Bar" },
  { id: "dessert", label: "Dessert" },
];

const CUISINES = [
  "pizza", "burger", "american", "chinese", "sandwich",
  "mexican", "italian", "chicken", "japanese", "thai",
];

const DIETARY = [
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "gluten_free", label: "Gluten free" },
  { id: "halal", label: "Halal" },
];

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const Chip = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={
      "rounded-full border px-3 py-1.5 text-sm font-medium transition " +
      (active
        ? "border-emerald-600 bg-emerald-600 text-white"
        : "border-gray-300 text-gray-700 hover:border-emerald-400 dark:border-gray-600 dark:text-gray-200")
    }
  >
    {children}
  </button>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </p>
    {children}
  </div>
);

export const DecidePage = ({
  onSelectRestaurant, onToggleFavorite, favorites, onCheckIn, visitStats,
}: Props) => {
  const [zip, setZip] = useState("18104");
  const [minutes, setMinutes] = useState(15);
  const [mode, setMode] = useState<"walk" | "drive">("drive");
  const [kinds, setKinds] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [openNow, setOpenNow] = useState(false);
  /* On by default. With no filters the shortlist is Subway, Dunkin' and
     McDonald's — technically the closest, and the least useful answer this app
     could give. Independent-only is the one thing it does that Maps will not,
     so it leads with it; the chip turns it off in one click. */
  const [independent, setIndependent] = useState(true);

  const [results, setResults] = useState<Restaurant[]>([]);
  const [considered, setConsidered] = useState(0);
  const [matchedTag, setMatchedTag] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: DecideParams = {
      zip: zip || undefined, minutes, mode, kinds, cuisines, dietary,
      openNow, independent, limit: 9,
    };

    /* The backend sleeps on Render's free tier, so the first call after an idle
       spell can take half a minute or simply fail. The old code caught that
       error, logged it, and left an empty list on screen forever — which is
       why this app looked broken to anyone who arrived first. Retry, and say
       what is happening while we do. */
    const wakeTimer = setTimeout(() => setWaking(true), 2500);
    try {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const data = await decideRestaurants(params);
          setResults(data.results);
          setConsidered(data.considered);
          setMatchedTag(data.matchedTag);
          return;
        } catch (err) {
          lastError = err;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      throw lastError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      clearTimeout(wakeTimer);
      setWaking(false);
      setLoading(false);
    }
  }, [zip, minutes, mode, kinds, cuisines, dietary, openNow, independent]);

  // One shortlist on arrival, so the page is never an empty shell.
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askedForTag = dietary.length > 0;

  return (
    <div className="px-4 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
          Where should we eat?
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Set the constraints. We'll narrow {considered ? `${considered} places` : "what's around you"} down
          to a handful and show why each one made it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* -- the constraints ------------------------------------------- */}
        <form
          className="h-fit rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          onSubmit={(e) => { e.preventDefault(); search(); }}
        >
          <Field label="Starting from">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="ZIP code"
              aria-label="ZIP code"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </Field>

          <Field label={`Within ${minutes} min ${mode}`}>
            <div className="mb-3 flex gap-2">
              <Chip active={mode === "walk"} onClick={() => setMode("walk")}>Walk</Chip>
              <Chip active={mode === "drive"} onClick={() => setMode("drive")}>Drive</Chip>
            </div>
            <input
              type="range" min={5} max={40} step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="Travel time in minutes"
              className="w-full accent-emerald-600"
            />
          </Field>

          <Field label="Kind of place">
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Chip key={k.id} active={kinds.includes(k.id)} onClick={() => setKinds(toggle(kinds, k.id))}>
                  {k.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Craving">
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <Chip key={c} active={cuisines.includes(c)} onClick={() => setCuisines(toggle(cuisines, c))}>
                  {c.replace(/_/g, " ")}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Dietary">
            <div className="flex flex-wrap gap-2">
              {DIETARY.map((d) => (
                <Chip key={d.id} active={dietary.includes(d.id)} onClick={() => setDietary(toggle(dietary, d.id))}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Only show">
            <div className="flex flex-wrap gap-2">
              <Chip active={openNow} onClick={() => setOpenNow(!openNow)}>Open now</Chip>
              <Chip active={independent} onClick={() => setIndependent(!independent)}>Independent</Chip>
            </div>
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Working it out…" : "Find us somewhere"}
          </button>
        </form>

        {/* -- the shortlist ---------------------------------------------- */}
        <section>
          {waking && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Waking the server — it sleeps when nobody's been by for a while. One moment.
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={search}
                className="mt-2 rounded border border-red-300 px-3 py-1 text-xs font-semibold hover:bg-red-100 dark:border-red-500/40 dark:hover:bg-red-500/10"
              >
                Try again
              </button>
            </div>
          )}

          {askedForTag && !loading && !error && (
            /* Say how thin the tag data is rather than implying the shortlist
               is the whole truth. Nine vegan-tagged places in the valley is a
               fact about OpenStreetMap, not about the valley. */
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {matchedTag} nearby {matchedTag === 1 ? "place is" : "places are"} actually tagged{" "}
              {dietary.map((d) => d.replace(/_/g, " ")).join(" / ")} on OpenStreetMap. Those come
              first; the rest simply aren't tagged either way.
            </p>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
              <p className="font-medium text-gray-700 dark:text-gray-200">Nothing fits all of that.</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Try widening the travel time, or dropping a filter.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                {results.length} of {considered} that fit — best match first.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={{ ...restaurant, isFavorite: favorites.includes(restaurant.id) }}
                    onClick={() => onSelectRestaurant(restaurant)}
                    onFavorite={() => onToggleFavorite(restaurant.id)}
                    visited={Boolean(visitStats[restaurant.id])}
                    visitCount={visitStats[restaurant.id]?.count}
                    lastVisited={visitStats[restaurant.id]?.lastVisited}
                    onCheckIn={() => onCheckIn(restaurant)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default DecidePage;
