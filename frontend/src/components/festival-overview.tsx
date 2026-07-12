import React from 'react';
import { FestivalOverview as FestivalOverviewData } from '../lib/home-page-types';

export interface FestivalOverviewProps {
  festival: FestivalOverviewData;
}

export function FestivalOverview({ festival }: FestivalOverviewProps) {
  const { eventDays, admissionFee, paymentNote } = festival;

  if (eventDays.length === 0 && !admissionFee) {
    return null;
  }

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {eventDays.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">開催日程</h3>
          <ul className="space-y-1">
            {eventDays.map((day, index) => (
              <li key={`${day.label}-${index}`} className="text-lg font-bold">
                {day.label}
                <span className="ml-2 text-sm font-normal text-gray-600">
                  {day.open} - {day.close}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {admissionFee && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">入場料</h3>
          <p className="text-lg font-bold">{admissionFee}</p>
          {paymentNote && (
            <p className="mt-1 text-sm text-gray-600">{paymentNote}</p>
          )}
        </div>
      )}
    </section>
  );
}
