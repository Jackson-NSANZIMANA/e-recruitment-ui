import React from "react";
import { useOfficerSession } from "@usrp/auth";
import type { ApiClient } from "@usrp/api-client";
import { ApplicationsPage } from "../ui/ApplicationsPage.tsx";

/** The slice owns the agency lookup: it comes from the session, never from a prop the host could get wrong. */
export default function ApplicationsListRoute({ client }: { readonly client: ApiClient }): React.ReactElement {
  const session = useOfficerSession();
  return <ApplicationsPage client={client} agency={session?.agency ?? "RDF"} />;
}
