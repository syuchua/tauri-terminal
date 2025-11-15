import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { listSessionSummaries } from "../../../services/sessions";
import type { SessionSummary } from "../../../shared/types";
import { useSessionsStore } from "../../../store/sessionsStore";

export const useSessionsQuery = () => {
  const setSessions = useSessionsStore((state) => state.setSessions);

  const query = useQuery<SessionSummary[]>({
    queryKey: ["sessions", "summaries"],
    queryFn: listSessionSummaries,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      setSessions(query.data);
    }
  }, [query.data, setSessions]);

  return query;
};
