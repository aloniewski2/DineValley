import React from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { VisitRecord } from "../../types";

interface VisitTimelineProps {
  visits: VisitRecord[];
  onSelectVisit?: (visit: VisitRecord) => void;
}

const formatVisitDate = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    };
  } catch {
    return { date: timestamp, time: "" };
  }
};

export const VisitTimeline: React.FC<VisitTimelineProps> = ({ visits, onSelectVisit }) => {
  if (!visits.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Check in after each meal to build your visit timeline.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-700 pl-4">
      {visits.map((visit, index) => {
        const date = formatVisitDate(visit.timestamp);
        return (
          <li key={visit.id ?? `${visit.restaurantId}-${index}`} className="mb-6 last:mb-0">
            <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-white dark:ring-gray-900" />
            <div className="flex flex-col gap-1 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{visit.snapshot.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{visit.snapshot.address}</p>
                </div>
                {onSelectVisit && (
                  <button
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                    type="button"
                    onClick={() => onSelectVisit(visit)}
                  >
                    View
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={14} />
                  {date.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={14} />
                  {date.time}
                </span>
                {visit.snapshot.types?.length ? (
                  <span className="inline-flex flex-wrap gap-1">
                    {visit.snapshot.types.slice(0, 3).map((type) => (
                      <span
                        key={`${visit.id}-${type}`}
                        className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 capitalize text-[11px] text-gray-600 dark:text-gray-300"
                      >
                        {type.replace(/_/g, " ")}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
