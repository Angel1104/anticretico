"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/db/supabase";

const REFRESH_DEBOUNCE_MS = 400;

export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel("properties-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "properties" },
        () => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
