import React from "react";
import { useOfficerSession } from "@usrp/auth";
import type { ApiClient } from "@usrp/api-client";
import { ApplicationDetailPage } from "../ui/ApplicationDetailPage.tsx";

export default function ApplicationDetailRoute({ client }: { readonly client: ApiClient }): React.ReactElement {
  const session = useOfficerSession();
  return <ApplicationDetailPage client={client} agency={session?.agency ?? "RDF"} />;
}
