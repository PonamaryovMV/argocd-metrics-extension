import * as React from "react";
import MetricsDashboard from "./dashboard/Dashboard";

export const Extension = (props: any) => <MetricsDashboard {...props} />;

export const component = Extension;

// Register the component as a "Metrics" tab on resource details in Argo CD.
((window: any) => {
  const opts = { icon: "fa fa-chart-area" };
  window?.extensionsAPI?.registerResourceExtension(component, "*", "Rollout", "Metrics", opts);
  window?.extensionsAPI?.registerResourceExtension(component, "", "Pod", "Metrics", opts);
  window?.extensionsAPI?.registerResourceExtension(component, "*", "Deployment", "Metrics", opts);
  window?.extensionsAPI?.registerResourceExtension(component, "*", "StatefulSet", "Metrics", opts);
})(window);
