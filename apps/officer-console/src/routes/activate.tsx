import React from "react";
import ActivateRoute from "@usrp/feature-identity/activate";
import { edgeClient } from "./slices.js";

/** Public route: the officer redeems the code a second administrator released. */
export default function Activate(): React.ReactElement {
  return <ActivateRoute client={edgeClient} />;
}
