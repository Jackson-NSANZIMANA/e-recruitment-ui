import React from "react";
import { ActivatePage } from "@usrp/feature-identity";
import { edgeClient } from "./slices.js";

/** Public route: the officer redeems the code a second administrator released. */
export default function ActivateRoute(): React.ReactElement {
  return <ActivatePage client={edgeClient} />;
}
