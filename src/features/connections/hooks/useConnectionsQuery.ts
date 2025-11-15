import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { listConnections } from "../../../services/connections";
import type { Connection } from "../../../shared/types";
import { useConnectionsStore } from "../../../store/connectionsStore";

export const useConnectionsQuery = () => {
  const setConnections = useConnectionsStore((state) => state.setConnections);

  const query = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: listConnections,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      setConnections(query.data);
    }
  }, [query.data, setConnections]);

  return query;
};
